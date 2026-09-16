import { Heart, Github, Code2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FooterSection() {
  return (
    <footer className="w-full border-t border-border/40 bg-gradient-to-t from-muted/20 to-transparent">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          {/* 署名 — 显著位置 */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-success flex items-center justify-center border-2 border-background">
                <Code2 className="w-2 h-2 text-success-foreground" />
              </div>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-foreground tracking-tight">
                洋洋制作
              </div>
              <div className="text-[11px] text-muted-foreground">
                Yangyang Studio · 专业画质
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            纯前端本地处理 · 图片不上传云端 · 隐私安全有保障
          </p>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 font-mono">
            <span>v1.0</span>
            <span className="text-border/60">·</span>
            <span>2048px长边缩放</span>
            <span className="text-border/60">·</span>
            <span className="flex items-center gap-1">
              用
              <Heart className="w-3 h-3 text-destructive/70 fill-destructive/30" />
              打造
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <a
              href="https://github.com/yyds8170-ctrl/image-resizer-2048"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all duration-200"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
