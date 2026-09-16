import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import type { IImageItem } from '@/data/image';
import {
  createImageItem,
  processImage,
  isSupportedImage,
  estimateMemoryMB,
  downloadBlob,
  buildOutputFileName,
} from '@/lib/imageProcessor';
import { isJsquashAvailable, initJsquash, type QualityMode } from '@/lib/jsquashEngine';
import HeaderSection from './sections/HeaderSection';
import DropZoneSection from './sections/DropZoneSection';
import ProgressSection from './sections/ProgressSection';
import ResultsSection from './sections/ResultsSection';
import QualityInfoSection from './sections/QualityInfoSection';
import FooterSection from './sections/FooterSection';

// 并发配置（canvas 回退模式）
const BASE_CONCURRENCY = 6;
const MAX_CONCURRENCY = 8;
const MEMORY_BUDGET_MB = 300;
const INIT_CONCURRENCY = 8;

// jSquash WASM 模式下并发更低（单线程 WASM，内存开销适中）
const JSQUASH_MAX_CONCURRENCY = 3;
const JSQUASH_MEMORY_BUDGET_MB = 400;

export default function ImageResizerPage() {
  const [images, setImages] = useState<IImageItem[]>([]);
  const [qualityMode, setQualityMode] = useState<QualityMode>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);
  const processingRef = useRef(false);
  const queueRef = useRef<IImageItem[]>([]);
  const cancelledRef = useRef(false);
  const qualityModeRef = useRef<QualityMode>('standard');

  useEffect(() => {
    qualityModeRef.current = qualityMode;
  }, [qualityMode]);

  const processedCount = useMemo(
    () =>
      images.filter(
        (i) => i.status === 'done' || i.status === 'skipped' || i.status === 'error',
      ).length,
    [images],
  );

  const calcConcurrency = useCallback((queue: IImageItem[]): number => {
    if (queue.length === 0) return BASE_CONCURRENCY;

    const useWasm = isJsquashAvailable();
    const maxConcurrency = useWasm ? JSQUASH_MAX_CONCURRENCY : MAX_CONCURRENCY;
    const memoryBudget = useWasm ? JSQUASH_MEMORY_BUDGET_MB : MEMORY_BUDGET_MB;

    const sample = queue.slice(0, maxConcurrency * 2);
    const avgMem =
      sample.reduce((sum, item) => sum + estimateMemoryMB(item), 0) / sample.length;

    if (avgMem < 20 && !useWasm) return maxConcurrency;

    const byMemory = Math.floor(memoryBudget / Math.max(avgMem, 1));
    return Math.max(1, Math.min(maxConcurrency, byMemory));
  }, []);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    // 预先初始化 jSquash（不阻塞，但尽快开始加载）
    initJsquash().catch(() => {});
    const imageFiles = files.filter((f) => isSupportedImage(f));

    if (imageFiles.length === 0) {
      toast.warning('未找到支持的图片文件', {
        description: '支持 JPG、PNG、WebP 格式',
      });
      return;
    }

    const skipped = files.length - imageFiles.length;
    if (skipped > 0) {
      toast.info(`已跳过 ${skipped} 个非图片文件`);
    }

    // 小图优先处理，提升感知速度
    imageFiles.sort((a, b) => a.size - b.size);

    try {
      const validItems: IImageItem[] = [];
      let idx = 0;
      let failed = 0;

      const workers = Array.from({ length: INIT_CONCURRENCY }, async () => {
        while (idx < imageFiles.length) {
          const currentIdx = idx++;
          const file = imageFiles[currentIdx];
          if (!file) break;
          try {
            const item = await createImageItem(file);
            validItems.push(item);
          } catch (err) {
            failed += 1;
            console.warn('[ImageResizer] 图片加载失败:', file.name, String(err));
          }
        }
      });
      await Promise.all(workers);

      if (validItems.length === 0) {
        toast.error('图片加载失败');
        return;
      }

      // 小图优先
      validItems.sort((a, b) => {
        const aLong = Math.max(a.originalWidth, a.originalHeight);
        const bLong = Math.max(b.originalWidth, b.originalHeight);
        return aLong - bLong;
      });

      setImages((prev) => [...prev, ...validItems]);

      if (failed > 0) {
        toast.info(`${validItems.length} 张已加入处理，${failed} 张加载失败`);
      } else {
        toast.success(`已添加 ${validItems.length} 张图片，开始处理`);
      }
    } catch (err) {
      console.error('[ImageResizer] 添加图片失败:', String(err));
      toast.error('添加图片失败');
    }
  }, []);

  const processNext = useCallback(async () => {
    while (queueRef.current.length > 0 && !cancelledRef.current) {
      const item = queueRef.current.shift();
      if (!item) break;

      setImages((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'processing' } : i)),
      );

      try {
        const result = await processImage(item, qualityModeRef.current);
        setImages((prev) =>
          prev.map((i) => (i.id === result.id ? result : i)),
        );
      } catch (err) {
        console.error('[ImageResizer] 处理失败:', item.name, String(err));
        setImages((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', errorMsg: '处理失败' }
              : i,
          ),
        );
      }
    }
  }, []);

  useEffect(() => {
    if (images.length === 0) {
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    const pending = images.filter((i) => i.status === 'pending');
    if (pending.length === 0) return;

    if (processingRef.current) {
      const existingIds = new Set(queueRef.current.map((i) => i.id));
      const newItems = pending.filter((i) => !existingIds.has(i.id));
      if (newItems.length > 0) {
        newItems.sort((a, b) => {
          const aLong = Math.max(a.originalWidth, a.originalHeight);
          const bLong = Math.max(b.originalWidth, b.originalHeight);
          return aLong - bLong;
        });
        queueRef.current.push(...newItems);
      }
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    cancelledRef.current = false;

    queueRef.current = [...pending].sort((a, b) => {
      const aLong = Math.max(a.originalWidth, a.originalHeight);
      const bLong = Math.max(b.originalWidth, b.originalHeight);
      return aLong - bLong;
    });

    const concurrency = calcConcurrency(queueRef.current);

    const runWorkers = async () => {
      const workers = Array.from({ length: concurrency }, () => processNext());
      await Promise.all(workers);

      if (!cancelledRef.current) {
        processingRef.current = false;
        setIsProcessing(false);
      }
    };

    runWorkers();

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const handleClear = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    setImages([]);
    processingRef.current = false;
    setIsProcessing(false);
    toast.success('已清空');
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = images.filter(
      (i) => i.status === 'done' || i.status === 'skipped',
    );
    if (doneItems.length === 0) return;

    setIsPackaging(true);
    try {
      const zip = new JSZip();

       for (const item of doneItems) {
         if (!item.processedBlob) continue;
         const filename =
           item.status === 'skipped'
             ? item.name
             : buildOutputFileName(item.name, item.outputMimeType || '');
         zip.file(filename, item.processedBlob);
       }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE',
      });
      downloadBlob(blob, `resized_images_${doneItems.length}.zip`);
      toast.success(`已打包下载 ${doneItems.length} 张图片`);
    } catch (err) {
      console.error('[ImageResizer] 打包失败:', String(err));
      toast.error('打包失败，请重试');
    } finally {
      setIsPackaging(false);
    }
  }, [images]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* 全局背景装饰 — 多层柔和径向光晕 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-[30%] -left-20 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-3xl" />
        <div className="absolute top-[60%] -right-20 w-[500px] h-[400px] bg-primary/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <main className="space-y-1">
          <HeaderSection />
          <DropZoneSection
            onFilesSelected={handleFilesSelected}
            hasImages={images.length > 0}
            qualityMode={qualityMode}
            onQualityModeChange={setQualityMode}
          />
          <ProgressSection
            total={images.length}
            processed={processedCount}
            isProcessing={isProcessing}
          />
          <ResultsSection
            images={images}
            onClear={handleClear}
            onDownloadAll={handleDownloadAll}
            isPackaging={isPackaging}
          />
          <QualityInfoSection />
          <FooterSection />
        </main>
      </div>
    </div>
  );
}
