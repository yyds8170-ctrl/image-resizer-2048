/**
 * jSquash Worker 池
 *
 * 真正的并行处理：每个 Worker 持有独立 WASM 实例、独立线程，
 * 多张图片可在多个线程上同时解码/缩放/编码。
 * 任何 Worker 初始化失败都会自动回退到主线程管线（功能不丢失）。
 */

interface WorkerProcessRequest {
  buffer: ArrayBuffer;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  qualityMode: 'standard' | 'lossless';
}

export interface WorkerProcessResult {
  blob: Blob;
  width: number;
  height: number;
  outputMimeType: string;
}

let pool: Worker[] = [];
let ready = false;
let initPromise: Promise<boolean> | null = null;
let nextIndex = 0;

/** 根据设备内存决定 Worker 数量（真正的并行度） */
export function getDesiredWorkerCount(): number {
  try {
    const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    const mem = typeof deviceMemory === 'number' && deviceMemory > 0 ? deviceMemory : 4;
    if (mem >= 16) return 6;
    if (mem >= 8) return 4;
    if (mem >= 4) return 2;
    return 1;
  } catch {
    return 2;
  }
}

export function getWorkerCount(): number {
  return ready ? pool.length : 0;
}

function createWorker(): Promise<Worker | null> {
  return new Promise((resolve) => {
    try {
      const worker = new Worker(new URL('./resizeWorker.ts', import.meta.url), {
        type: 'module',
      });
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          worker.terminate();
          resolve(null);
        }
      }, 20000);

      worker.onmessage = (e: MessageEvent<{ type: string; ok?: boolean }>) => {
        if (e.data?.type === 'ready') {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          if (e.data.ok) {
            resolve(worker);
          } else {
            worker.terminate();
            resolve(null);
          }
        }
      };
      worker.onerror = () => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        worker.terminate();
        resolve(null);
      };
      worker.postMessage({ type: 'init' });
    } catch {
      resolve(null);
    }
  });
}

/** 初始化 Worker 池（幂等，失败自动回退） */
export function initWorkerPool(): Promise<boolean> {
  if (ready) return Promise.resolve(true);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof Worker === 'undefined') return false;
      const count = getDesiredWorkerCount();
      const workers = await Promise.all(
        Array.from({ length: count }, () => createWorker()),
      );
      pool = workers.filter((w): w is Worker => w !== null);
      ready = pool.length > 0;
      if (ready) {
        console.info(`[WorkerPool] 就绪，${pool.length} 路并行`);
      } else {
        console.warn('[WorkerPool] 无可用 Worker，回退主线程管线');
      }
      return ready;
    } catch {
      ready = false;
      pool = [];
      return false;
    }
  })();

  return initPromise;
}

/** 通过 Worker 池处理一张图片（round-robin 分配） */
export function processWithWorkers(request: WorkerProcessRequest): Promise<WorkerProcessResult> {
  return new Promise((resolve, reject) => {
    if (!ready || pool.length === 0) {
      reject(new Error('Worker 池未就绪'));
      return;
    }

    const worker = pool[nextIndex % pool.length];
    nextIndex += 1;

    const id = Math.floor(Math.random() * 1_000_000_000);
    let settled = false;

    const onMessage = (e: MessageEvent<{ type: string; id?: number; buffer?: ArrayBuffer; width?: number; height?: number; mimeType?: string; message?: string }>) => {
      const data = e.data;
      if (data.id !== id) return;
      settled = true;
      worker.removeEventListener('message', onMessage);
      if (data.type === 'done' && data.buffer && data.width && data.height && data.mimeType) {
        resolve({
          blob: new Blob([data.buffer], { type: data.mimeType }),
          width: data.width,
          height: data.height,
          outputMimeType: data.mimeType,
        });
      } else {
        reject(new Error(data.message || 'Worker 处理失败'));
      }
    };

    worker.addEventListener('message', onMessage);
    worker.postMessage(
      {
        type: 'process',
        id,
        buffer: request.buffer,
        mimeType: request.mimeType,
        originalWidth: request.originalWidth,
        originalHeight: request.originalHeight,
        targetWidth: request.targetWidth,
        targetHeight: request.targetHeight,
        qualityMode: request.qualityMode,
      },
      [request.buffer],
    );
  });
}
