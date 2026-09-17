import { Loader2, CheckCircle2, Clock, Sparkles, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressSectionProps {
  total: number;
  processed: number;
  isProcessing: boolean;
  isReading?: boolean;
  readDone?: number;
  readTotal?: number;
  processingName?: string;
}

export default function ProgressSection({
  total,
  processed,
  isProcessing,
  isReading = false,
  readDone = 0,
  readTotal = 0,
  processingName,
}: ProgressSectionProps) {
  // 读取阶段：只要有文件正在读取就显示读取进度（可能还没任何图片加入列表）
  if (total === 0 && !isReading) return null;

  const readPercent = readTotal > 0 ? Math.round((readDone / readTotal) * 100) : 0;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isComplete = total > 0 && processed === total && !isProcessing && !isReading;

  return (
    <section className="w-full">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <motion.div
          layout
          className="bg-gradient-to-br from-card to-muted/30 border border-border/70 rounded-xl p-4 md:p-5 space-y-3.5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AnimatePresence mode="wait" initial={false}>
                {isReading ? (
                  <motion.div
                    key="reading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative">
                      <FileSearch className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      正在读取{' '}
                      <span className="font-mono text-primary tabular-nums">{readDone}</span> /{' '}
                      {readTotal}
                    </span>
                  </motion.div>
                ) : isProcessing ? (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      正在处理{' '}
                      <span className="font-mono text-primary tabular-nums">{processed}</span> /{' '}
                      {total}
                      {processingName && (
                        <span className="ml-1.5 text-muted-foreground font-normal max-w-[220px] truncate inline-block align-bottom">
                          {processingName}
                        </span>
                      )}
                    </span>
                  </motion.div>
                ) : isComplete ? (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [0.8, 1.4, 1], opacity: [0, 0.3, 0] }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="absolute inset-0 rounded-full bg-success/30"
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      全部处理完成，共 <span className="font-mono tabular-nums">{total}</span> 张
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-primary/60" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      等待中，共 <span className="font-mono tabular-nums">{total}</span> 张
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span
              className={cn(
                'text-sm font-mono font-bold tabular-nums transition-colors duration-300',
                isComplete ? 'text-success' : 'text-primary',
              )}
            >
              {isReading ? readPercent : percentage}%
            </span>
          </div>

          {/* 自定义进度条 */}
          <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              initial={false}
              animate={{
                width: `${isReading ? readPercent : percentage}%`,
                backgroundColor: isComplete ? 'hsl(152 40% 38%)' : 'hsl(215 32% 22%)',
              }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
            {/* 进度条微光 */}
            {(isProcessing || isReading) && (
              <motion.div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
