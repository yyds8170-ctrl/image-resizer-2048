import { useState, useEffect, memo } from 'react';
import { Download, Check, AlertTriangle, FileImage, Minus, Maximize2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/image';
import type { IImageItem } from '@/data/image';
import { TARGET_LONG_SIDE } from '@/data/image';
import { formatFileSize, downloadBlob, buildOutputFileName } from '@/lib/imageProcessor';
import { cn } from '@/lib/utils';

interface ResultsSectionProps {
  images: IImageItem[];
  onClear: () => void;
  onDownloadAll: () => void;
  isPackaging: boolean;
}

function ResultsSection({ images, onClear, onDownloadAll, isPackaging }: ResultsSectionProps) {
  const doneCount = images.filter((i) => i.status === 'done' || i.status === 'skipped').length;
  const canDownloadAll = doneCount > 0 && !isPackaging;

  if (images.length === 0) {
    return null;
  }

  const skippedCount = images.filter((i) => i.status === 'skipped').length;
  const errorCount = images.filter((i) => i.status === 'error').length;

  return (
    <section className="w-full pb-16 md:pb-20">
      <div className="max-w-4xl mx-auto px-4 md:px-6 space-y-5">
        {/* 操作栏 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex items-center justify-between flex-wrap gap-3 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <FileImage className="w-4 h-4" />
            <span>
              共 <span className="font-semibold text-foreground font-mono tabular-nums">{images.length}</span> 张
            </span>
            {doneCount > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="text-success">
                  <span className="font-semibold font-mono tabular-nums">{doneCount - skippedCount - errorCount}</span> 已缩放
                </span>
              </>
            )}
            {skippedCount > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="text-warning-foreground/80">
                  <span className="font-mono tabular-nums">{skippedCount}</span> 已符合
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="h-8 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              清空
            </Button>
            <Button
              size="sm"
              onClick={onDownloadAll}
              disabled={!canDownloadAll}
              className="gap-1.5 h-8 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {isPackaging ? '打包中...' : '全部打包下载'}
            </Button>
          </div>
        </motion.div>

        {/* 结果网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          <AnimatePresence initial={false}>
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(index * 0.04, 0.4),
                  ease: [0.16, 1, 0.3, 1],
                }}
                layout
              >
                <ResultCard item={img} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

interface ResultCardProps {
  item: IImageItem;
}

const ResultCard = memo(function ResultCard({ item }: ResultCardProps) {
  const [downloaded, setDownloaded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [processedUrl, setProcessedUrl] = useState<string>('');

  useEffect(() => {
    const origUrl = URL.createObjectURL(item.file);
    setOriginalUrl(origUrl);
    return () => URL.revokeObjectURL(origUrl);
  }, [item.file]);

  useEffect(() => {
    if (item.processedBlob) {
      const procUrl = URL.createObjectURL(item.processedBlob);
      setProcessedUrl(procUrl);
      return () => URL.revokeObjectURL(procUrl);
    }
  }, [item.processedBlob]);

  const handleDownload = () => {
    if (!item.processedBlob) return;
    const filename =
      item.status === 'skipped' ? item.name : buildOutputFileName(item.name, item.outputMimeType || '');
    downloadBlob(item.processedBlob, filename);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const hasResult = item.processedBlob && processedUrl;
  const currentSrc = showOriginal && hasResult ? originalUrl : (processedUrl || originalUrl);

  const statusBadge = () => {
    switch (item.status) {
      case 'done':
        return (
          <Badge className="gap-1 bg-success/10 text-success hover:bg-success/15 border-0 font-medium shadow-sm">
            <Check className="w-3 h-3" />
            已缩放
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="secondary" className="gap-1 font-medium">
            <Minus className="w-3 h-3" />
            已符合要求
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            失败
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline" className="gap-1 text-primary border-primary/20 bg-primary/5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            处理中
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            等待中
          </Badge>
        );
    }
  };

  const sizeChange =
    item.status === 'done' && item.originalSize > 0
      ? Math.round((1 - item.processedSize / item.originalSize) * 100)
      : 0;

  const scalePercent = item.originalWidth > 0
    ? Math.round((item.processedWidth / item.originalWidth) * 100)
    : 0;

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden flex flex-col group hover:shadow-lg hover:border-border/80 transition-all duration-300 hover:-translate-y-0.5">
      {/* 预览图 */}
      <div
        className="relative aspect-[4/3] bg-gradient-to-br from-muted/40 to-muted/20 overflow-hidden cursor-zoom-in"
        onMouseEnter={() => setShowOriginal(true)}
        onMouseLeave={() => setShowOriginal(false)}
      >
        <Image
          src={currentSrc}
          alt={item.name}
          className="w-full h-full object-contain transition-all duration-300 group-hover:scale-[1.02]"
        />

        {/* 状态标签 */}
        <div className="absolute top-2.5 right-2.5">{statusBadge()}</div>

        {/* 输出格式标签 */}
        {item.status === 'done' && item.outputMimeType && item.outputMimeType !== item.file.type && (
          <div className="absolute top-2.5 left-2.5">
            <Badge variant="outline" className="text-[10px] font-mono bg-background/80 backdrop-blur-sm border-border/50">
              {item.outputMimeType === 'image/webp' ? 'WebP' : item.outputMimeType}
            </Badge>
          </div>
        )}

        {/* 底部信息条 */}
        {(item.status === 'done' || item.status === 'skipped') && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2.5 py-2 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-[2px]">
            <div className="flex items-center gap-1 text-[10px] font-mono text-foreground/80">
              <Maximize2 className="w-3 h-3" />
              {item.status === 'done'
                ? `${item.processedWidth}×${item.processedHeight}`
                : `${item.originalWidth}×${item.originalHeight}`}
            </div>
            {item.status === 'done' && (
              <div className="text-[10px] font-mono text-primary/80">
                {scalePercent}% 原图
              </div>
            )}
          </div>
        )}

        {/* before / after 切换指示 */}
        {item.status === 'done' && (
          <div
            className={cn(
              'absolute bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[10px] font-mono',
              'bg-background/90 backdrop-blur-sm px-2.5 py-1 rounded-full border border-border/50',
              'transition-all duration-200',
              showOriginal ? 'opacity-100' : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0',
            )}
          >
            <span className={cn('transition-colors', showOriginal ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              原图
            </span>
            <div className="w-8 h-0.5 bg-border rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={false}
                animate={{ width: showOriginal ? '50%' : '100%' }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <span className={cn('transition-colors', showOriginal ? 'text-muted-foreground' : 'text-foreground font-medium')}>
              处理后
            </span>
          </div>
        )}
      </div>

      {/* 信息区 */}
      <div className="p-4 space-y-3.5 flex-1 flex flex-col">
        <div className="text-sm font-medium text-foreground truncate" title={item.name}>
          {item.name}
        </div>

        {/* 前后尺寸对比 */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 bg-muted/40 rounded-lg p-2.5 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">原图</div>
            <div className="font-mono font-semibold text-foreground tabular-nums text-sm">
              {item.originalWidth}×{item.originalHeight}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {formatFileSize(item.originalSize)}
            </div>
          </div>
          <div className="text-muted-foreground/40 shrink-0">
            <ArrowRight className="w-4 h-4" />
          </div>
          <div className="flex-1 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] rounded-lg p-2.5 space-y-1 border border-primary/10">
            <div className="text-[10px] uppercase tracking-wider text-primary/60 font-medium">处理后</div>
            <div
              className={cn(
                'font-mono font-semibold tabular-nums text-sm',
                item.status === 'done' || item.status === 'skipped'
                  ? 'text-foreground'
                  : 'text-muted-foreground/50',
              )}
            >
              {item.status === 'done' || item.status === 'skipped'
                ? `${item.processedWidth}×${item.processedHeight}`
                : '—'}
            </div>
            <div
              className={cn(
                'text-[11px] tabular-nums',
                item.status === 'done' || item.status === 'skipped'
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground/40',
              )}
            >
              {item.status === 'done' || item.status === 'skipped'
                ? formatFileSize(item.processedSize)
                : '—'}
            </div>
          </div>
        </div>

        {/* 体积变化 + 进度 */}
        {item.status === 'done' && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>体积变化</span>
              <span
                className={cn(
                  'font-mono font-semibold tabular-nums',
                  sizeChange > 0 ? 'text-success' : 'text-warning-foreground/80',
                )}
              >
                {sizeChange > 0 ? `-${sizeChange}%` : `+${Math.abs(sizeChange)}%`}
              </span>
            </div>
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  sizeChange > 0 ? 'bg-success/60' : 'bg-warning/60',
                )}
                style={{ width: `${Math.max(5, 100 - sizeChange)}%` }}
              />
            </div>
          </div>
        )}

        {item.status === 'processing' && (
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary/60 rounded-full"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ width: '40%' }}
            />
          </div>
        )}

        {item.status === 'error' && item.errorMsg && (
          <div className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md px-2 py-1.5">
            {item.errorMsg}
          </div>
        )}

        <div className="mt-auto pt-1">
          <Button
            size="sm"
            variant="secondary"
            className="w-full gap-1.5 h-8 hover:bg-primary hover:text-primary-foreground transition-all duration-200"
            onClick={handleDownload}
            disabled={!item.processedBlob || item.status === 'error'}
          >
            {downloaded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                已下载
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                下载
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default memo(ResultsSection);
