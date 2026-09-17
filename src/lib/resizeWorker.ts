/**
 * jSquash 处理 Worker
 *
 * 每个 Worker 持有独立的 WASM 实例，在独立线程上执行完整的
 * decode → Lanczos3 线性光缩放 → encode 管线，实现真正的并行处理。
 * 主线程通过 postMessage 传递 ArrayBuffer（transferable，零拷贝）。
 */
import { decode as jpegDecode, encode as jpegEncode } from '@jsquash/jpeg';
import { decode as pngDecode, encode as pngEncode } from '@jsquash/png';
import { decode as webpDecode, encode as webpEncode } from '@jsquash/webp';
import resize from '@jsquash/resize';

let ready = false;

function checkReady(): boolean {
  return (
    typeof jpegDecode === 'function' &&
    typeof jpegEncode === 'function' &&
    typeof pngDecode === 'function' &&
    typeof pngEncode === 'function' &&
    typeof webpDecode === 'function' &&
    typeof webpEncode === 'function' &&
    typeof resize === 'function'
  );
}

interface ProcessMessage {
  type: 'process';
  id: number;
  buffer: ArrayBuffer;
  mimeType: string;
  targetWidth: number;
  targetHeight: number;
  qualityMode: 'standard' | 'lossless';
}

self.onmessage = async (e: MessageEvent<{ type: string; ok?: boolean } | ProcessMessage>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    // 模块已在 import 时完成加载，这里只做能力确认
    const ok = checkReady();
    ready = ok;
    (self as unknown as Worker).postMessage({ type: 'ready', ok });
    return;
  }

  if (msg.type === 'process') {
    const p = msg as ProcessMessage;
    try {
      if (!ready) {
        // 首次处理前再做一次确认（某些环境下 init 消息可能未先到达）
        ready = checkReady();
        if (!ready) throw new Error('jSquash worker 未就绪');
      }

      // 1. 解码
      let imageData: ImageData;
      if (p.mimeType === 'image/jpeg') {
        imageData = await jpegDecode(p.buffer, { preserveOrientation: true });
      } else if (p.mimeType === 'image/png') {
        imageData = await pngDecode(p.buffer);
      } else if (p.mimeType === 'image/webp') {
        imageData = await webpDecode(p.buffer);
      } else {
        throw new Error('不支持的格式');
      }

      // 2. Lanczos3 缩放 + 线性光（与主线程管线参数完全一致）
      const resized = await resize(imageData, {
        width: p.targetWidth,
        height: p.targetHeight,
        method: 'lanczos3',
        fitMethod: 'stretch',
        linearRGB: true,
        premultiply: true,
      });

      // 3. 编码（与主线程管线参数完全一致）
      let outputBuffer: ArrayBuffer;
      let outputMimeType: string;

      if (p.qualityMode === 'lossless') {
        // lossless: 1 = 无损（类型定义为 number，1/0 语义等价 boolean）
        outputBuffer = await webpEncode(resized, { lossless: 1, quality: 75 });
        outputMimeType = 'image/webp';
      } else {
        outputMimeType = p.mimeType;
        if (p.mimeType === 'image/jpeg') {
          outputBuffer = await jpegEncode(resized, {
            quality: 95,
            baseline: false,
            progressive: true,
            arithmetic: false,
          });
        } else if (p.mimeType === 'image/png') {
          outputBuffer = await pngEncode(resized);
        } else {
          outputBuffer = await webpEncode(resized, { quality: 95, lossless: 0 });
        }
      }

      (self as unknown as Worker).postMessage(
        {
          type: 'done',
          id: p.id,
          buffer: outputBuffer,
          width: resized.width,
          height: resized.height,
          mimeType: outputMimeType,
        },
        [outputBuffer],
      );
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'error',
        id: p.id,
        message: err instanceof Error ? err.message : '处理失败',
      });
    }
  }
};
