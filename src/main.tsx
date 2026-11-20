import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/dev-sw.js?dev-sw', {scope: '/', type: 'classic'})
      .catch(() => {
        // Ignore dev SW registration errors in restricted iframes
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
