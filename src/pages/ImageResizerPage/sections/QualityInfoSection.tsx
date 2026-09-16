import { useState, useEffect } from 'react';
import {
  Wand2,
  LineChart,
  Sparkles,
  ShieldCheck,
  Layers,
  CheckCircle2,
  AlertCircle,
  Zap,
  Diamond,
  Target,
  Eye,
  Palette,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { initJsquash, isJsquashAvailable } from '@/lib/jsquashEngine';

const FEATURES = [
  {
    icon: Wand2,
    title: 'Lanczos3 重采样',
    desc: '三瓣 Lanczos 核，Squoosh / Photoshop 同款，边缘锐利无锯齿',
    highlight: true,
  },
  {
    icon: LineChart,
    title: '线性光空间缩放',
    desc: '在物理线性光空间降采样，gamma 校正正确，暗部不发灰、渐变无色带',
    highlight: true,
  },
  {
    icon: Sparkles,
    title: 'MozJPEG 高质量编码',
    desc: 'Mozilla 出品业界最佳 JPEG 编码器，Q=95 + progressive，细节保留更完整',
  },
  {
    icon: Diamond,
    title: 'WebP Lossless 无损输出',
    desc: '极致保真模式专用，缩放结果像素级零损失，比 PNG 小约 26%',
    highlight: true,
  },
  {
    icon: Eye,
    title: '阈值 USM 锐化',
    desc: '仅在边缘处锐化，平滑区域不放大噪点，细节更通透自然',
  },
  {
    icon: Layers,
    title: 'WASM 全链路',
    desc: '解码→缩放→编码全链路 WASM，绕过 Canvas 8bit 精度限制，零累积损失',
  },
  {
    icon: ShieldCheck,
    title: '纯前端本地处理',
    desc: '图片不上传服务器，全程在浏览器内完成，隐私安全有保障',
  },
  {
    icon: Zap,
    title: '智能自动回退',
    desc: 'WASM 引擎不可用时自动回退到 Canvas 高清管线，始终可用',
  },
  {
    icon: Target,
    title: 'Alpha 预乘处理',
    desc: '透明图缩放时预乘 alpha，边缘无黑边、无锯齿，完美保留透明通道',
  },
];

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function QualityInfoSection() {
  const [engineReady, setEngineReady] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      initJsquash()
        .then((ready) => {
          if (mounted) setEngineReady(ready);
        })
        .catch(() => {
          if (mounted) setEngineReady(false);
        });
    }, 800);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const available = engineReady === true || isJsquashAvailable();

  return (
    <section className="w-full py-12 md:py-20 border-t border-border/40 bg-gradient-to-b from-muted/10 to-background relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-primary/[0.03] rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 md:px-6">
        {/* 标题 + 引擎状态 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-10 space-y-4"
        >
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary/70 tracking-[0.2em] uppercase">
            <Palette className="w-3.5 h-3.5" />
            Professional Image Pipeline
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            专业级画质引擎
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            基于 MozJPEG + Lanczos3 构建的 WASM 全链路处理管线，
            线性光空间缩放 + 双画质模式，媲美 Photoshop 导出品质
          </p>

          {/* 引擎状态徽章 */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {engineReady === null ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/70 px-3 py-1.5 rounded-full border border-border/60">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                引擎检测中...
              </span>
            ) : available ? (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="inline-flex items-center gap-1.5 text-[11px] text-success-foreground bg-success/15 px-3 py-1.5 rounded-full border border-success/30 shadow-sm"
              >
                <CheckCircle2 className="w-3 h-3" />
                WASM 专业引擎已就绪 · Lanczos3 + 线性光
              </motion.span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-warning-foreground bg-warning/15 px-3 py-1.5 rounded-full border border-warning/30">
                <AlertCircle className="w-3 h-3" />
                Canvas 高清模式（自动回退）
              </span>
            )}
          </div>
        </motion.div>

        {/* 双画质模式对比 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
        >
          <div className="relative bg-card border border-border/60 rounded-2xl p-5 md:p-6 overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-muted/50 to-transparent rounded-bl-[100%] opacity-60" />
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muted to-muted/50 text-muted-foreground flex items-center justify-center border border-border/50 shadow-sm">
                  <Wand2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">标准模式</h3>
                  <p className="text-[11px] text-muted-foreground">平衡画质与体积</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                保持原格式输出，JPEG 使用 MozJPEG Q=95 高质量渐进式编码，
                配合带阈值 USM 锐化强化边缘细节，肉眼几乎无损。
              </p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>JPEG: MozJPEG Q=95 + progressive</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>阈值 USM 锐化（数量 100% · 半径 1px）</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>保持原格式，文件体积友好</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-card border border-primary/20 rounded-2xl p-5 md:p-6 overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-[100%] opacity-70" />
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                <Sparkles className="w-2.5 h-2.5" />
                推荐
              </span>
            </div>
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
                  <Diamond className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">极致保真 · 无损输出</h3>
                  <p className="text-[11px] text-primary/70">像素级零编码损失</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                缩放后输出 WebP Lossless，像素级零损失保存。
                重采样结果 100% 原样保留，接近 Photoshop 智能对象级别的画质。
              </p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>WebP Lossless · 像素级零损失</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>比 PNG 小约 26%，完美保留透明通道</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>不锐化，完全保留原始像素数据</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 9 个特性卡片 */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className={`bg-card border rounded-xl p-4 md:p-5 hover:shadow-md transition-all duration-200 ${
                f.highlight
                  ? 'border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent'
                  : 'border-border/60'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    f.highlight
                      ? 'bg-primary/10 text-primary border border-primary/15'
                      : 'bg-muted/70 text-muted-foreground border border-border/50'
                  }`}
                >
                  <f.icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* 处理管线说明 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="mt-10 bg-card border border-border/60 rounded-2xl p-5 md:p-7 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <span className="w-1 h-4 bg-primary rounded-full" />
            处理管线
          </h3>
          <div className="flex flex-wrap items-center gap-2 md:gap-2.5 text-xs">
            {[
              { label: '原始文件', active: true },
              { label: 'WASM 解码', active: false },
              { label: '线性光 Lanczos3 缩放', active: true, primary: true },
              { label: '可选阈值 USM', active: false },
              { label: 'MozJPEG / WebP Lossless', active: false },
              { label: '输出', active: true, success: true },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center gap-2 md:gap-2.5">
                <span
                  className={`px-3 py-2 rounded-lg border font-medium ${
                    step.primary
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : step.success
                      ? 'bg-success/10 border-success/20 text-success-foreground'
                      : step.active
                      ? 'bg-muted/70 border-border/60 text-foreground'
                      : 'bg-muted/40 border-border/40 text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
                {index < 5 && (
                  <span className="text-muted-foreground/30">→</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* 参数一览 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          {[
            { value: '2048px', label: '长边目标' },
            { value: 'Q=95', label: 'JPEG 质量' },
            { value: 'Lanczos3', label: '重采样核' },
            { value: '0 损失', label: '极致保真模式' },
          ].map((param) => (
            <div
              key={param.label}
              className="bg-card border border-border/60 rounded-xl p-4 text-center hover:shadow-sm hover:border-border/80 transition-all duration-200"
            >
              <div className="text-xl md:text-2xl font-bold text-primary font-mono tracking-tight">
                {param.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{param.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
