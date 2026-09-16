import { Sparkles, Maximize2, Zap, Shield, Diamond } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HeaderSection() {
  return (
    <section className="w-full pt-16 md:pt-24 pb-10 md:pb-12 relative overflow-hidden">
      {/* 背景装饰 — 柔和径向渐变光晕 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-3xl" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-primary/[0.02] rounded-full blur-2xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 md:px-6 text-center space-y-7">
        {/* 署名 + 标签 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex items-center justify-center gap-3"
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/[0.06] border border-primary/10 text-xs font-medium text-primary/80 tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/30 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/50" />
            </span>
            洋洋制作
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-success/15 to-primary/10 border border-success/20 text-xs font-medium text-success">
            <Sparkles className="w-3 h-3" />
            Lanczos3 专业级画质
          </div>
        </motion.div>

        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.08]">
            图片长边缩放
            <span className="block md:inline md:ml-3 mt-1.5 md:mt-0">
              <span className="relative inline-block font-mono text-primary text-3xl md:text-5xl font-bold tracking-tighter">
                <span className="relative z-10">2048px</span>
                <span className="absolute -bottom-1 left-0 right-0 h-2 bg-primary/10 -z-0 rounded-sm" />
              </span>
            </span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            拖拽图片或文件夹，自动将长边等比缩放至 2048 像素。
            <br className="hidden md:block" />
            <span className="text-foreground/70">Lanczos3 重采样 · 线性光空间 · 无损输出可选</span>
          </p>
        </motion.div>

        {/* 特性标签 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
          className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pt-1"
        >
          <FeatureBadge icon={Maximize2} label="等比缩放" />
          <FeatureBadge icon={Zap} label="批量处理" />
          <FeatureBadge icon={Shield} label="不上传云端" />
          <FeatureBadge icon={Diamond} label="无损输出" highlight />
        </motion.div>
      </div>
    </section>
  );
}

function FeatureBadge({
  icon: Icon,
  label,
  highlight = false,
}: {
  icon: typeof Maximize2;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border text-xs font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        highlight
          ? 'bg-gradient-to-br from-primary/[0.06] to-transparent border-primary/20 text-primary'
          : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-primary' : 'text-primary/70'}`} />
      <span>{label}</span>
    </div>
  );
}
