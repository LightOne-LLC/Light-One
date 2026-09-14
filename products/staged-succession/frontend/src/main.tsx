import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// Check for a new deployed version periodically and whenever the installed
// PWA is brought back to the foreground. No onNeedRefresh/UI prompt is
// wired up on purpose: with registerType: 'prompt' (see vite.config.ts) the
// new service worker simply waits and activates itself the next time the
// app is fully closed and reopened — no forced reload of an active session.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
