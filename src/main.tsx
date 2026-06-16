import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// iframe 埋め込み時は自然高さ + 親ページ側スクロール 1 本にする（二重スクロール回避）。
// 参照識別の === 比較はクロスオリジンでも安全。
try {
  if (window.self !== window.top) {
    document.documentElement.dataset.embedded = 'true';
  }
} catch {
  document.documentElement.dataset.embedded = 'true';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
