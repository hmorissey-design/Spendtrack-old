import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Guard against benign browser IndexedDB & Firestore background tab closing events
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    if (
      msg.includes('Database is closing') ||
      msg.includes('closing/hidden') ||
      msg.includes('connection is closing') ||
      msg.includes('client is offline') ||
      msg.includes('IndexedDB')
    ) {
      event.preventDefault();
      console.warn('Handled benign background database lifecycle event:', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = String(event.message || event.error?.message || '');
    if (
      msg.includes('Database is closing') ||
      msg.includes('closing/hidden') ||
      msg.includes('connection is closing')
    ) {
      event.preventDefault();
      console.warn('Handled benign background database window event:', msg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
