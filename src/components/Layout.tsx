import { Outlet } from 'react-router-dom';

/**
 * 全局布局：仅承载子路由出口
 * 页面自身的背景装饰与视觉层级由各页面组件负责
 */
export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Outlet />
    </div>
  );
}
