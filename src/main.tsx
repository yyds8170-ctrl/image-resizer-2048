import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app';
import './index.css';

// basename 与 vite base 保持一致（GitHub Pages 子路径部署），
// 使 React Router 正确匹配 /image-resizer-2048/ 下的路由
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
