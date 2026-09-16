/**
 * 画质模式
 * - standard: 标准模式，保持原格式，有损高质量编码
 * - lossless: 极致保真模式，输出 WebP Lossless（无损，体积比 PNG 小约 26%）
 */
export type QualityMode = 'standard' | 'lossless';

/**
 * jSquash 专业级 WASM 图像处理引擎
 * 基于 Google Squoosh 同款 WASM 编解码 + 缩放库
 *
 * 特点：
 * - 单线程 WASM，不需要 SharedArrayBuffer / COOP-COEP
 * - MozJPEG 编码（业界最佳 JPEG 质量）
 * - Lanczos3 重采样（默认）+ 线性光处理
 * - PNG 无损、WebP 高质量 / 无损
 *
 * 包：@jsquash/jpeg (MozJPEG) + @jsquash/png + @jsquash/webp + @jsquash/resize
 */

type EngineStatus = 'idle' | 'initializing' | 'ready' | 'failed';

let status: EngineStatus = 'idle';
let initPromise: Promise<boolean> | null = null;
let resizeModule: any = null;
let jpegModule: any = null;
let pngModule: any = null;
let webpModule: any = null;

/**
 * 懒加载并初始化 jSquash 各模块
 * 首次调用时加载，后续复用
 * 任何错误都会被捕获，返回 false 触发 Canvas 回退
 */
export function initJsquash(): Promise<boolean> {
  if (status === 'ready') return Promise.resolve(true);
  if (status === 'failed') return Promise.resolve(false);
  if (status === 'initializing' && initPromise) return initPromise;

  status = 'initializing';
  initPromise = doInit()
    .then((ok) => {
      status = ok ? 'ready' : 'failed';
      return ok;
    })
    .catch((err) => {
      console.warn('[jSquash] 初始化失败:', String(err).slice(0, 200));
      status = 'failed';
      return false;
    });

  return initPromise;
}

export function isJsquashAvailable(): boolean {
  return status === 'ready';
}

async function doInit(): Promise<boolean> {
  try {
    // 并行加载四个模块（WASM 按需自动加载，首次调用时触发）
    const [resizePkg, jpegPkg, pngPkg, webpPkg] = await Promise.all([
      import('@jsquash/resize'),
      import('@jsquash/jpeg'),
      import('@jsquash/png'),
      import('@jsquash/webp'),
    ]);

    // @jsquash/resize 默认导出就是 resize 函数
    resizeModule = resizePkg.default ?? resizePkg;
    jpegModule = jpegPkg;
    pngModule = pngPkg;
    webpModule = webpPkg;

    // 验证必要 API 存在
    if (typeof resizeModule !== 'function') {
      console.warn('[jSquash] resize 模块格式异常');
      return false;
    }
    if (typeof jpegModule.decode !== 'function' || typeof jpegModule.encode !== 'function') {
      console.warn('[jSquash] jpeg 模块缺少 decode/encode');
      return false;
    }
    if (typeof pngModule.decode !== 'function' || typeof pngModule.encode !== 'function') {
      console.warn('[jSquash] png 模块缺少 decode/encode');
      return false;
    }
    if (typeof webpModule.decode !== 'function' || typeof webpModule.encode !== 'function') {
      console.warn('[jSquash] webp 模块缺少 decode/encode');
      return false;
    }

    console.info('[jSquash] 引擎就绪');
    return true;
  } catch (err) {
    console.warn('[jSquash] 模块加载失败:', String(err).slice(0, 200));
    return false;
  }
}

interface ProcessInput {
  file: File;
  mimeType: string;
  targetWidth: number;
  targetHeight: number;
  qualityMode: QualityMode;
}

interface ProcessOutput {
  blob: Blob;
  width: number;
  height: number;
  outputMimeType: string;
}

/**
 * 使用 jSquash 处理单张图片
 * 完整管线：WASM 解码 → Lanczos3 + 线性光缩放 → 编码
 *
 * 标准模式：保持原格式，JPEG 用 MozJPEG Q=95 + 4:4:4 + progressive
 * 无损模式：输出 WebP Lossless，缩放结果像素级零损失保存
 */
export async function processWithJsquash(input: ProcessInput): Promise<ProcessOutput> {
  if (status !== 'ready') {
    throw new Error('jSquash 未就绪');
  }

  const { file, mimeType, targetWidth, targetHeight, qualityMode } = input;
  const arrayBuffer = await file.arrayBuffer();

  // 1. 解码
  let imageData: ImageData;
  if (mimeType === 'image/jpeg') {
    imageData = await jpegModule.decode(arrayBuffer, { preserveOrientation: true });
  } else if (mimeType === 'image/png') {
    imageData = await pngModule.decode(arrayBuffer);
  } else if (mimeType === 'image/webp') {
    imageData = await webpModule.decode(arrayBuffer);
  } else {
    throw new Error('不支持的格式');
  }

  // 2. Lanczos3 缩放 + 线性光（linearRGB 默认 true）
  //    premultiply: true → alpha 预乘，处理透明图缩放时边缘无黑边
  const resized = await resizeModule(imageData, {
    width: targetWidth,
    height: targetHeight,
    method: 'lanczos3',
    fitMethod: 'stretch',
    linearRGB: true,
    premultiply: true,
  });

  const outWidth = resized.width;
  const outHeight = resized.height;

  // 3. 编码（按画质模式选择输出格式）
  let outputBuffer: ArrayBuffer;
  let outputMimeType: string;

  if (qualityMode === 'lossless') {
    // 极致保真模式：WebP Lossless 输出
    // lossless: true → WebP 无损，像素级零损失
    // 比 PNG 平均小 26%，支持透明通道
    outputBuffer = await webpModule.encode(resized, {
      lossless: true,
      // WebP 无损模式下 quality 参数控制压缩速度/效率
      // 0 = 最快体积最大，100 = 最慢体积最小
      // 选 75 平衡压缩率和速度
      quality: 75,
    });
    outputMimeType = 'image/webp';
  } else {
    // 标准模式：保持原格式
    outputMimeType = mimeType;

    if (mimeType === 'image/jpeg') {
      // MozJPEG 高质量参数
      // quality: 95（max 100）
      // progressive: true → 渐进式 JPEG，更好的压缩质量比
      outputBuffer = await jpegModule.encode(resized, {
        quality: 95,
        baseline: false,
        progressive: true,
        arithmetic: false,
      });
    } else if (mimeType === 'image/png') {
      // PNG 无损
      outputBuffer = await pngModule.encode(resized);
    } else if (mimeType === 'image/webp') {
      // WebP 高质量有损
      outputBuffer = await webpModule.encode(resized, {
        quality: 95,
        lossless: false,
      });
    } else {
      throw new Error('不支持的格式');
    }
  }

  const blob = new Blob([outputBuffer], { type: outputMimeType });
  return { blob, width: outWidth, height: outHeight, outputMimeType };
}
