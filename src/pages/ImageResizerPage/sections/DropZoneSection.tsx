import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, FolderOpen, Image as ImageIcon, ArrowUpFromLine, Sparkles, Check, Wand2, Diamond, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QualityMode } from '@/lib/jsquashEngine';

interface DropZoneSectionProps {
  onFilesSelected: (files: File[]) => void;
  hasImages: boolean;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
}

export default function DropZoneSection({
  onFilesSelected,
  hasImages,
  qualityMode,
  onQualityModeChange,
}: DropZoneSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const extractFilesFromDataTransfer = useCallback(
    async (dataTransfer: DataTransfer): Promise<File[]> => {
      const files: File[] = [];

      if (dataTransfer.items && dataTransfer.items.length > 0) {
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < dataTransfer.items.length; i++) {
          const item = dataTransfer.items[i];
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) entries.push(entry);
          }
        }

        if (entries.length > 0) {
          for (const entry of entries) {
            await traverseEntry(entry, files);
          }
          return files;
        }
      }

      if (dataTransfer.files) {
        for (let i = 0; i < dataTransfer.files.length; i++) {
          const f = dataTransfer.files[i];
          if (f) files.push(f);
        }
      }

      return files;
    },
    [],
  );

  const traverseEntry = async (entry: FileSystemEntry, results: File[]): Promise<void> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        fileEntry.file(
          (file) => {
            results.push(file);
            resolve();
          },
          () => resolve(),
        );
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const readAll = async () => {
          const readBatch = (): Promise<FileSystemEntry[]> =>
            new Promise((res) => {
              reader.readEntries(
                (batch) => res(batch),
                () => res([]),
              );
            });

          let allEntries: FileSystemEntry[] = [];
          let batch: FileSystemEntry[];
          do {
            batch = await readBatch();
            allEntries = allEntries.concat(batch);
          } while (batch.length > 0);

          for (const e of allEntries) {
            await traverseEntry(e, results);
          }
          resolve();
        };
        readAll();
      } else {
        resolve();
      }
    });
  };

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!e.dataTransfer) return;
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) onFilesSelected(files);
    },
    [extractFilesFromDataTransfer, onFilesSelected],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(Array.from(files));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onFilesSelected],
  );

  const handleFolderSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(Array.from(files));
      }
      if (folderInputRef.current) folderInputRef.current.value = '';
    },
    [onFilesSelected],
  );

  const QualityModeToggle = () => (
    <div className="relative inline-flex p-1 bg-muted/60 rounded-xl border border-border/50 shadow-inner">
      <AnimatePresence initial={false}>
        <motion.div
          layoutId="quality-mode-indicator"
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-card shadow-sm border border-border/60"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          style={{ left: qualityMode === 'standard' ? '4px' : 'calc(50% + 0px)' }}
        />
      </AnimatePresence>
      <button
        onClick={() => onQualityModeChange('standard')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors w-28',
          qualityMode === 'standard' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
        )}
      >
        <Wand2 className="w-3.5 h-3.5" />
        标准模式
      </button>
      <button
        onClick={() => onQualityModeChange('lossless')}
        className={cn(
          'relative z-10 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors w-28',
          qualityMode === 'lossless' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
        )}
      >
        <Diamond className="w-3.5 h-3.5" />
        极致保真
      </button>
    </div>
  );

  if (hasImages) {
    return (
      <section className="w-full">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 h-8"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                添加图片
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                className="gap-1.5 h-8"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                添加文件夹
              </Button>
            </div>
            <QualityModeToggle />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />
      </section>
    );
  }

  return (
    <section className="w-full">
      <div className="max-w-4xl mx-auto px-4 md:px-6 space-y-5">
        {/* 画质模式选择 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2.5"
        >
          <QualityModeToggle />
          <AnimatePresence mode="wait">
            <motion.p
              key={qualityMode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-xs text-muted-foreground text-center max-w-md leading-relaxed"
            >
              {qualityMode === 'standard'
                ? '保持原格式输出 · JPEG MozJPEG Q95 高质量 + 阈值 USM 锐化 · 文件体积友好'
                : '缩放结果零编码损失 · 输出 WebP Lossless（比 PNG 小约 26%）· 像素级保留'}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* 拖拽区 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-12 md:p-16 text-center cursor-pointer transition-all duration-300 ease-out',
              'flex flex-col items-center justify-center gap-6 group',
              'bg-gradient-to-br from-card/80 via-card/40 to-muted/20 backdrop-blur-sm',
              isDragging
                ? 'border-primary bg-primary/[0.04] scale-[1.015] shadow-xl shadow-primary/10'
                : 'border-border/60 hover:border-primary/30 hover:shadow-lg hover:shadow-foreground/[0.02]',
            )}
          >
            {/* 四角装饰 — 像素角标 */}
            <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-primary/20 rounded-tl-sm" />
            <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-primary/20 rounded-tr-sm" />
            <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-primary/20 rounded-bl-sm" />
            <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-primary/20 rounded-br-sm" />

            {/* 2048 像素角标 */}
            <div className="absolute top-4 right-5 font-mono text-[11px] text-muted-foreground/40 tracking-widest font-bold">
              2048 →
            </div>

            {/* 上传图标 */}
            <motion.div
              animate={isDragging ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                'relative w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300',
                'bg-gradient-to-br from-muted to-muted/50 text-muted-foreground',
                'shadow-inner border border-border/50',
                'group-hover:from-primary/10 group-hover:to-primary/[0.02] group-hover:text-primary group-hover:border-primary/20 group-hover:shadow-md group-hover:shadow-primary/5',
                isDragging && 'from-primary/15 to-primary/5 text-primary border-primary/30 shadow-lg shadow-primary/10',
              )}
            >
              <ArrowUpFromLine className="w-8 h-8" strokeWidth={1.5} />
              {/* 光晕效果 */}
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500',
                  'bg-[radial-gradient(circle_at_50%_40%,hsl(215_32%_22%_/_0.08),transparent_70%)]',
                  (isDragging) && 'opacity-100',
                )}
              />
            </motion.div>

            {/* 文字 */}
            <div className="space-y-2.5">
              <p className="text-xl font-semibold text-foreground tracking-tight">
                {isDragging ? '松开鼠标以上传' : '拖拽图片或文件夹到此处'}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                支持 JPG、PNG、WebP 格式
                <br className="md:hidden" />
                <span className="hidden md:inline"> · </span>
                Lanczos3 + 线性光 + 无损输出可选
              </p>
            </div>

            {/* 按钮组 */}
            <div className="flex items-center gap-3 pt-1">
              <Button size="sm" className="gap-1.5 h-10 px-5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <Upload className="w-4 h-4" />
                选择图片
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-10 px-5 hover:bg-secondary/80 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
              >
                <FolderOpen className="w-4 h-4" />
                选择文件夹
              </Button>
            </div>

            {/* 底部提示 + 信息 */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground/50 font-mono">
              <span>JPG / PNG / WEBP</span>
              <span className="text-border/60">·</span>
              <span>长边 2048</span>
              <span className="text-border/60">·</span>
              <span>等比缩放</span>
            </div>

            {/* 信息小提示 */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
              <Info className="w-3 h-3" />
              <span>纯前端处理，图片不上传云端</span>
            </div>
          </div>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />
      </div>
    </section>
  );
}
