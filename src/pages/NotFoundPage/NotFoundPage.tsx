import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
        <ImageOff className="w-7 h-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">页面不存在</h1>
        <p className="text-sm text-muted-foreground">你访问的页面不存在或已被移动</p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center justify-center min-h-9 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
      >
        返回首页
      </Link>
    </div>
  );
}
