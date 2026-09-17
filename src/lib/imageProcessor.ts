import type { IImageItem } from '@/data/image';
import { TARGET_LONG_SIDE, SUPPORTED_FORMATS } from '@/data/image';
import { initJsquash, isJsquashAvailable, processWithJsquash, type QualityMode } from './jsquashEngine';
import { initWorkerPool, processWithWorkers, getWorkerCount } from './workerPool';

const JPEG_QUALITY = 0.95;
const WEBP_QUALITY = 0.95;

// ========================================
// 带阈值的 USM 锐化参数（Adobe 推荐区间）
// - 数量 amount: 0.8~1.2 (80%~120%)，中等强度
// - 半径 radius: 1.0~1.2px，只强化细细节
// - 阈值 threshold: 2~4（0-255 尺度），忽略平滑区域，不放大噪点
// ========================================
const USM_AMOUNT = 1.0;
const USM_RADIUS = 1.0;
const USM_THRESHOLD = 3;

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `img_${Date.now().toString(36)}_${idCounter}`;
}

function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return '';
}

/**
 * 根据原始文件名 + 输出 MIME 类型构建处理后的文件名
 * 无损模式下 JPEG 输入变 .webp 后缀
 */
export function buildOutputFileName(originalName: string, outputMimeType: string): string {
  const dotIndex = originalName.lastIndexOf('.');
  const base = dotIndex === -1 ? originalName : originalName.slice(0, dotIndex);

  let ext = '';
  if (outputMimeType === 'image/jpeg') ext = '.jpg';
  else if (outputMimeType === 'image/png') ext = '.png';
  else if (outputMimeType === 'image/webp') ext = '.webp';
  else if (dotIndex !== -1) ext = originalName.slice(dotIndex);

  return `${base}_resized${ext}`;
}

export function isSupportedImage(file: File): boolean {
  const type = getMimeType(file);
  return SUPPORTED_FORMATS.includes(type);
}

/**
 * 从文件头解析图片尺寸（JPEG / PNG / WebP）
 * 只读取文件前 64KB，完全不解码像素数据，
 * 相比 createImageBitmap（解码整图）内存开销可忽略，
 * 是批量处理大图时避免内存爆炸的关键优化。
 */
function parseDimensionsFromHeader(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const blob = file.slice(0, 64 * 1024);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buf = reader.result as ArrayBuffer;
          const bytes = new Uint8Array(buf);
          const view = new DataView(buf);

          // --- PNG: 固定头 8 字节，IHDR 尺寸在 offset 16/20 ---
          if (
            bytes.length >= 24 &&
            bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
          ) {
            const width = view.getUint32(16);
            const height = view.getUint32(20);
            if (width > 0 && height > 0) {
              resolve({ width, height });
              return;
            }
          }

          // --- JPEG: 遍历 marker 找 SOF（SOF0~SOF15，排除 DHT/DAC/DNL） ---
          if (
            bytes.length >= 4 &&
            bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          ) {
            let offset = 2;
            while (offset + 9 < bytes.length) {
              if (bytes[offset] !== 0xff) {
                offset++;
                continue;
              }
              const marker = bytes[offset + 1];
              if (marker >= 0xc0 && marker <= 0xcf &&
                  marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                const height = view.getUint16(offset + 5);
                const width = view.getUint16(offset + 7);
                if (width > 0 && height > 0) {
                  resolve({ width, height });
                  return;
                }
              }
              const segLen = view.getUint16(offset + 2);
              if (segLen < 2) break;
              offset += 2 + segLen;
            }
          }

          // --- WebP: RIFF/WEBP 容器 ---
          if (
            bytes.length >= 30 &&
            bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
          ) {
            const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
            if (chunkType === 'VP8 ' && bytes.length >= 30) {
              // VP8 有损：帧标签 3 + 起始码 3 + 宽 2（14bit）+ 高 2
              const width = view.getUint16(26, true) & 0x3fff;
              const height = view.getUint16(28, true) & 0x3fff;
              if (width > 0 && height > 0) { resolve({ width, height }); return; }
            } else if (chunkType === 'VP8L' && bytes.length >= 25) {
              // VP8L 无损：签名 1 字节 + 打包位 4 字节（14bit 宽-1 / 14bit 高-1）
              const bits = view.getUint32(21, true);
              const width = (bits & 0x3fff) + 1;
              const height = ((bits >> 14) & 0x3fff) + 1;
              if (width > 0 && height > 0) { resolve({ width, height }); return; }
            } else if (chunkType === 'VP8X' && bytes.length >= 30) {
              // VP8X 扩展：画布宽-1 / 高-1（各 24bit LE）
              const width = ((bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) & 0xffffff) + 1;
              const height = ((bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) & 0xffffff) + 1;
              if (width > 0 && height > 0) { resolve({ width, height }); return; }
            }
          }

          resolve(null);
        } catch {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(blob);
    } catch {
      resolve(null);
    }
  });
}

export async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  // 优先文件头解析：零解码、零内存压力
  const fromHeader = await parseDimensionsFromHeader(file);
  if (fromHeader) return fromHeader;

  // 兜底：createImageBitmap 解码整图（仅当头部解析失败）
  try {
    if (typeof createImageBitmap !== 'undefined') {
      const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none' });
      const { width, height } = bitmap;
      bitmap.close();
      return { width, height };
    }
  } catch {
    // fallthrough
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

export async function createImageItem(file: File): Promise<IImageItem> {
  const dims = await readImageDimensions(file);
  return {
    id: generateId(),
    file,
    name: file.name,
    originalWidth: dims.width,
    originalHeight: dims.height,
    originalSize: file.size,
    processedBlob: null,
    processedWidth: 0,
    processedHeight: 0,
    processedSize: 0,
    status: 'pending',
  };
}

/**
 * 主处理入口：自动选择最佳画质管线
 *
 * 优先管线 A：jSquash (MozJPEG + Lanczos3 + 线性光 WASM)
 *   - 单线程 WASM，不需要 SharedArrayBuffer，所有浏览器环境可用
 *   - 解码：MozJPEG / rust-png / libwebp 专业级解码器
 *   - 缩放：Lanczos3 三瓣核 + 线性光空间处理，暗部不发灰、渐变无色带
 *   - 编码：MozJPEG Q=95 高质量 progressive JPEG，PNG 无损，WebP 高质量
 *   - 完全绕过 Canvas 的 8bit gamma 空间限制
 *
 * 回退管线 B：Canvas 线性光 + 多步高质量降采样 + USM 锐化
 *   - sRGB → 线性光 → 多步降采样 → sRGB（gamma 完全正确）
 *   - 每步 ≤50%，多步逼近 Lanczos 级质量
 *   - 极轻 USM 锐化补偿，细节更锐利
 */
export async function processImage(
  item: IImageItem,
  qualityMode: QualityMode = 'standard',
): Promise<IImageItem> {
  const updated: IImageItem = { ...item, status: 'processing' };

  try {
    const longSide = Math.max(item.originalWidth, item.originalHeight);

    // 长边已经 <= 目标值，跳过
    if (longSide <= TARGET_LONG_SIDE) {
      updated.status = 'skipped';
      updated.processedBlob = item.file;
      updated.processedWidth = item.originalWidth;
      updated.processedHeight = item.originalHeight;
      updated.processedSize = item.originalSize;
      return updated;
    }

    // 先尝试 jSquash WASM 管线（Worker 池并行 → 主线程回退）
    const jsquashReady = await initJsquash();
    if (jsquashReady && isJsquashAvailable()) {
      try {
        const ratio = TARGET_LONG_SIDE / Math.max(item.originalWidth, item.originalHeight);
        const isWidthLonger = item.originalWidth >= item.originalHeight;
        const targetWidth = isWidthLonger ? TARGET_LONG_SIDE : Math.round(item.originalWidth * ratio);
        const targetHeight = isWidthLonger ? Math.round(item.originalHeight * ratio) : TARGET_LONG_SIDE;

        const mimeType = getMimeType(item.file);
        let result: { blob: Blob; width: number; height: number; outputMimeType: string };

        // Worker 池可用：独立线程 + 独立 WASM 实例，多张图真正并行
        const workerCount = getWorkerCount();
        if (workerCount > 0) {
          result = await processWithWorkers({
            buffer: await item.file.arrayBuffer(),
            mimeType,
            originalWidth: item.originalWidth,
            originalHeight: item.originalHeight,
            targetWidth,
            targetHeight,
            qualityMode,
          });
        } else {
          // 主线程回退：单线程 WASM（同步执行，一次一张）
          result = await processWithJsquash({
            file: item.file,
            mimeType,
            targetWidth,
            targetHeight,
            qualityMode,
          });
        }

        updated.status = 'done';
        updated.processedBlob = result.blob;
        updated.processedWidth = result.width;
        updated.processedHeight = result.height;
        updated.processedSize = result.blob.size;
        updated.outputMimeType = result.outputMimeType;
        return updated;
      } catch {
        // jSquash 失败时静默回退到 canvas 管线
      }
    }

    // 回退：Canvas 线性光 + 多步高质量降采样
    const result = await processWithCanvas(item, qualityMode);
    updated.status = 'done';
    updated.processedBlob = result.blob;
    updated.processedWidth = result.width;
    updated.processedHeight = result.height;
    updated.processedSize = result.blob.size;
    updated.outputMimeType = result.outputMimeType;
    return updated;
  } catch (err) {
    updated.status = 'error';
    updated.errorMsg = err instanceof Error ? err.message : '处理失败';
  }

  return updated;
}

// =========================================================================
// 管线 A：jSquash WASM 专业级处理
// 见 src/lib/jsquashEngine.ts
// =========================================================================

interface ProcessResult {
  blob: Blob;
  width: number;
  height: number;
  outputMimeType?: string;
}

// =========================================================================
// 管线 B：Canvas 线性光 + 多步高质量降采样 + USM 锐化
// =========================================================================

// LUT 缓存（只计算一次）
let srgbToLinearLut: Float32Array | null = null;
let linearToSrgbLut: Uint8Array | null = null;

function ensureLuts(): void {
  if (srgbToLinearLut && linearToSrgbLut) return;

  srgbToLinearLut = new Float32Array(256);
  linearToSrgbLut = new Uint8Array(256);

  for (let i = 0; i < 256; i++) {
    // sRGB → 线性光（标准 sRGB transfer function，分段近似）
    const s = i / 255;
    let linear: number;
    if (s <= 0.04045) {
      linear = s / 12.92;
    } else {
      linear = Math.pow((s + 0.055) / 1.055, 2.4);
    }
    srgbToLinearLut[i] = linear;

    // 线性光 → sRGB（反函数，LUT 的索引量化为 0-255）
    const lin = i / 255;
    let srgb: number;
    if (lin <= 0.0031308) {
      srgb = lin * 12.92;
    } else {
      srgb = 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;
    }
    // 这个LUT是按线性光值索引的，用于"线性光→sRGB"
    // 实际使用时我们用浮点线性值直接算，不用LUT（因为浮点不能索引）
    linearToSrgbLut[i] = Math.round(srgb * 255);
  }
}

/**
 * 将 ImageData 从 sRGB 转换为线性光
 * 线性光值以 0-255 范围内的 8bit 存储（用于后续 drawImage 平均）
 * 注意：暗部会被压缩到较小的值，但多步缩小的每步都是50%，平均后值通常不会太小
 */
function srgbToLinear(imgData: ImageData): void {
  ensureLuts();
  const lut = srgbToLinearLut!;
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(lut[data[i]] * 255);          // R
    data[i + 1] = Math.round(lut[data[i + 1]] * 255);  // G
    data[i + 2] = Math.round(lut[data[i + 2]] * 255);  // B
    // Alpha 保持不变（alpha 是线性的）
  }
}

/**
 * 将 ImageData 从线性光转回 sRGB
 * 线性光值范围 0-255（8bit 线性光表示）
 */
function linearToSrgb(imgData: ImageData): void {
  ensureLuts();
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    data[i] = linearFloatToSrgbByte(r);
    data[i + 1] = linearFloatToSrgbByte(g);
    data[i + 2] = linearFloatToSrgbByte(b);
    // Alpha 保持不变
  }
}

function linearFloatToSrgbByte(lin: number): number {
  if (lin <= 0.0031308) {
    return Math.round(lin * 12.92 * 255);
  }
  return Math.round((1.055 * Math.pow(lin, 1 / 2.4) - 0.055) * 255);
}

async function processWithCanvas(
  item: IImageItem,
  qualityMode: QualityMode,
): Promise<ProcessResult> {
  const mimeType = getMimeType(item.file);
  const longSide = Math.max(item.originalWidth, item.originalHeight);
  const ratio = TARGET_LONG_SIDE / longSide;
  const newWidth = Math.round(item.originalWidth * ratio);
  const newHeight = Math.round(item.originalHeight * ratio);

  const isPng = mimeType === 'image/png';
  // 锐化只在有损输出模式启用；无损模式不锐化（保持像素级零损失）
  const shouldSharpen = qualityMode !== 'lossless' && USM_AMOUNT > 0 && !isPng;

  // 多步降采样规划（每步约 50%，模拟 Lanczos 高质量缩小）
  const totalRatio = ratio;
  const steps = totalRatio < 0.5 ? Math.max(2, Math.ceil(Math.log(totalRatio) / Math.log(0.5))) : 1;

  let currentBitmap: ImageBitmap | null = null;

  try {
    // 加载原始图像
    if (typeof createImageBitmap !== 'undefined') {
      try {
        currentBitmap = await createImageBitmap(item.file, { premultiplyAlpha: 'none' });
      } catch {
        currentBitmap = await loadBitmapViaImage(item.file);
      }
    } else {
      currentBitmap = await loadBitmapViaImage(item.file);
    }

    let curW = currentBitmap.width;
    let curH = currentBitmap.height;

    // 第一步：转线性光（如果有多步）
    // 对于单步（缩小比例 > 0.5），我们做一次"线性光单步缩放"
    // 对于多步，只在最开始转一次线性光，中间保持线性光，最后转回 sRGB
    const useLinearLight = totalRatio < 0.85; // 缩小比例较小时才需要线性光校正

    if (useLinearLight && steps > 1) {
      // 多步：先把源图转线性光
      const srcCanvas = getCanvas(curW, curH);
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) throw new Error('Canvas 不可用');
      srcCtx.drawImage(currentBitmap, 0, 0);
      currentBitmap.close();

      try {
        const srcData = srcCtx.getImageData(0, 0, curW, curH);
        srgbToLinear(srcData);
        srcCtx.putImageData(srcData, 0, 0);
        currentBitmap = await createImageBitmap(srcCanvas, { premultiplyAlpha: 'none' });
      } catch {
        // 转换失败，退回原始 bitmap
        currentBitmap = await createImageBitmap(srcCanvas, { premultiplyAlpha: 'none' });
      }
    }

    // 中间步骤：逐步缩小（每步约 50%）
    for (let i = 0; i < steps - 1; i++) {
      const midW = Math.max(newWidth, Math.round(curW * 0.5));
      const midH = Math.max(newHeight, Math.round(curH * 0.5));
      if (midW >= curW || midH >= curH) break;

      const canvas = getCanvas(midW, midH);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 不可用');

      // 高质量缩放
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(currentBitmap, 0, 0, midW, midH);

      currentBitmap.close();
      try {
        currentBitmap = await createImageBitmap(canvas, { premultiplyAlpha: 'none' });
      } catch {
        currentBitmap = await createImageBitmap(canvas);
      }
      curW = midW;
      curH = midH;
    }

    // 最后一步：精确缩放到目标尺寸
    const finalCanvas = getCanvas(newWidth, newHeight);
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) throw new Error('Canvas 不可用');

    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(currentBitmap, 0, 0, newWidth, newHeight);

    currentBitmap.close();
    currentBitmap = null;

    // 如果走了线性光流程，最后转回 sRGB
    if (useLinearLight && steps > 1) {
      try {
        const finalData = finalCtx.getImageData(0, 0, newWidth, newHeight);
        linearToSrgb(finalData);
        finalCtx.putImageData(finalData, 0, 0);
      } catch {
        // 转换失败不影响
      }
    } else if (useLinearLight && steps === 1) {
      // 单步但缩小比例较大：做一次"先转线性光再缩放再转回"的完整流程
      // 但前面已经直接缩放了，这里做 gamma 补偿近似
      compensateGammaApprox(finalCtx, newWidth, newHeight, totalRatio);
    }

    // 可选锐化（带阈值 USM，仅有损输出）
    if (shouldSharpen) {
      applyUnsharpMask(finalCtx, newWidth, newHeight, {
        amount: USM_AMOUNT,
        radius: USM_RADIUS,
        threshold: USM_THRESHOLD,
      });
    }

    // 导出：按质量模式选择输出格式
    const outputMimeType = qualityMode === 'lossless' ? 'image/webp' : mimeType;
    const blob: Blob = await new Promise((resolve, reject) => {
      if (outputMimeType === 'image/webp' && qualityMode === 'lossless') {
        // Canvas WebP 有损，没有无损参数控制；
        // 这里用 1.0 quality 近似，但注意：Canvas 的 toBlob 'image/webp' 仍是有损
        // 真正的无损 WebP 只有 jSquash 管线能做到，Canvas 回退下退化为高质量有损
        finalCanvas.toBlob(
          (b) => { if (b) resolve(b); else reject(new Error('导出 Blob 失败')); },
          'image/webp',
          0.98,
        );
      } else {
        const quality =
          outputMimeType === 'image/jpeg'
            ? JPEG_QUALITY
            : outputMimeType === 'image/webp'
            ? WEBP_QUALITY
            : undefined;

        finalCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('导出 Blob 失败'));
          },
          outputMimeType,
          quality,
        );
      }
    });

    return { blob, width: newWidth, height: newHeight, outputMimeType };
  } finally {
    if (currentBitmap && typeof currentBitmap.close === 'function') {
      try { currentBitmap.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * 单步缩放下的 gamma 补偿近似
 * 对于缩小比例不太大（>0.5）的情况，直接对结果做 gamma 调整
 * 这是一个经验近似，效果比纯 drawImage 好
 */
function compensateGammaApprox(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
): void {
  // 缩小比例越小，gamma 偏差越大
  // scale=0.5 时约需 gamma 0.90（提亮暗部）
  const gamma = 1.0 - (1.0 - scale) * 0.2;
  if (Math.abs(gamma - 1.0) < 0.02) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const lut = new Uint8Array(256);
    const invGamma = 1.0 / gamma;
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.round(255 * Math.pow(i / 255, invGamma)));
    }
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // 静默跳过
  }
}

function loadBitmapViaImage(file: File | Blob): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (typeof createImageBitmap !== 'undefined') {
        createImageBitmap(img)
          .then(resolve)
          .catch(reject);
        return;
      }
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => {},
      } as unknown as ImageBitmap);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

function getCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * 带阈值的非锐化蒙版（Unsharp Mask with Threshold）
 *
 * 参数说明（参考 Adobe Photoshop USM）：
 * - amount (数量): 0.8 ~ 1.2，锐化强度，即 edge 上叠加的差值比例
 * - radius (半径): 1.0 ~ 1.5px，高斯模糊半径，决定锐化作用的尺度
 * - threshold (阈值): 2 ~ 4（0-255 尺度）
 *   当 |original - blurred| < threshold 时不锐化，保护平滑区域（皮肤/天空）不放大噪点
 *
 * 实现：
 * 1. 用 3x3 高斯近似生成模糊版
 * 2. 计算差值（mask = original - blurred）
 * 3. 差值小于阈值的像素跳过（阈值保护）
 * 4. result = original + amount * mask
 *
 * 注：半径 1.0px 对应一个 3x3 核足够精确；更大半径需要更大的核
 */
function applyUnsharpMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: { amount: number; radius: number; threshold: number },
): void {
  if (width < 100 || height < 100) return;
  if (opts.amount <= 0) return;

  const { amount, threshold } = opts;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const original = new Uint8ClampedArray(data);

    // 3x3 高斯近似（sigma ≈ 1.0）
    // 权重：中心 4, 上下左右 1, 四角 0.5，总和 = 8
    const centerW = 4;
    const sideW = 1;
    const diagW = 0.5;
    const totalW = centerW + 4 * sideW + 4 * diagW; // = 8

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const xMinus = x > 0 ? idx - 4 : idx;
        const xPlus = x < width - 1 ? idx + 4 : idx;
        const yMinus = y > 0 ? idx - width * 4 : idx;
        const yPlus = y < height - 1 ? idx + width * 4 : idx;
        const xMinusYMinus = x > 0 && y > 0 ? idx - width * 4 - 4 : idx;
        const xPlusYMinus = x < width - 1 && y > 0 ? idx - width * 4 + 4 : idx;
        const xMinusYPlus = x > 0 && y < height - 1 ? idx + width * 4 - 4 : idx;
        const xPlusYPlus = x < width - 1 && y < height - 1 ? idx + width * 4 + 4 : idx;

        for (let c = 0; c < 3; c++) {
          const centerVal = original[idx + c];
          const blurred = (
            centerVal * centerW +
            (original[xMinus + c] + original[xPlus + c] + original[yMinus + c] + original[yPlus + c]) * sideW +
            (original[xMinusYMinus + c] + original[xPlusYMinus + c] + original[xMinusYPlus + c] + original[xPlusYPlus + c]) * diagW
          ) / totalW;

          const diff = centerVal - blurred;
          // 阈值保护：差值小于阈值的像素不锐化
          if (Math.abs(diff) < threshold) {
            continue;
          }

          // unsharp: original + amount * (original - blurred)
          let result = centerVal + amount * diff;
          result = result < 0 ? 0 : result > 255 ? 255 : result;
          data[idx + c] = result;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch {
    // 静默跳过
  }
}

/**
 * 估算单张图处理的内存占用（用于动态并发控制）
 */
export function estimateMemoryMB(item: IImageItem): number {
  return (item.originalWidth * item.originalHeight * 4 * 4 * 1.5) / (1024 * 1024);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildResizedFileName(originalName: string): string {
  // 兼容旧 API：保持原扩展名
  return buildOutputFileName(originalName, '');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
