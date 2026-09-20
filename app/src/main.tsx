import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';
import axios from 'axios';

// ── Browser Console Debugging: Live Axios Network Interceptors ──
axios.interceptors.request.use(
  (config) => {
    (config as any).__startTime = Date.now();
    const timeStr = new Date().toLocaleTimeString();
    console.log(
      `%c[API REQ] %c${config.method?.toUpperCase()} %c${config.url}`,
      'background: #0284c7; color: white; padding: 2px 5px; border-radius: 4px; font-weight: bold;',
      'color: #38bdf8; font-weight: bold;',
      'color: #94a3b8;',
      config.data ? { payload: config.data } : ''
    );
    window.dispatchEvent(
      new CustomEvent('akademiya-debug-log', {
        detail: {
          id: Math.random().toString(),
          time: timeStr,
          type: 'http-req',
          title: `${config.method?.toUpperCase()} ${config.url}`,
          details: config.data,
        },
      })
    );
    return config;
  },
  (error) => {
    console.error(
      `%c[API REQ ERR]`,
      'background: #ef4444; color: white; padding: 2px 5px; border-radius: 4px; font-weight: bold;',
      error
    );
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    const elapsed = Date.now() - ((response.config as any).__startTime || Date.now());
    const timeStr = new Date().toLocaleTimeString();
    console.log(
      `%c[API RES] %c${response.status} %c${response.config.url} %c(${elapsed}ms)`,
      'background: #059669; color: white; padding: 2px 5px; border-radius: 4px; font-weight: bold;',
      'color: #34d399; font-weight: bold;',
      'color: #94a3b8;',
      'color: #64748b;',
      response.data
    );
    window.dispatchEvent(
      new CustomEvent('akademiya-debug-log', {
        detail: {
          id: Math.random().toString(),
          time: timeStr,
          type: 'http-res',
          title: `${response.status} ${response.config.url} (${elapsed}ms)`,
          details: response.data,
        },
      })
    );
    return response;
  },
  (error) => {
    const elapsed = Date.now() - ((error.config as any)?.__startTime || Date.now());
    const timeStr = new Date().toLocaleTimeString();
    console.error(
      `%c[API ERR] %c${error.response?.status || 'FAILED'} %c${error.config?.url} %c(${elapsed}ms)`,
      'background: #dc2626; color: white; padding: 2px 5px; border-radius: 4px; font-weight: bold;',
      'color: #f87171; font-weight: bold;',
      'color: #94a3b8;',
      'color: #ef4444;',
      error.response?.data || error.message
    );
    window.dispatchEvent(
      new CustomEvent('akademiya-debug-log', {
        detail: {
          id: Math.random().toString(),
          time: timeStr,
          type: 'http-err',
          title: `${error.response?.status || 'ERR'} ${error.config?.url || 'API Error'} (${elapsed}ms)`,
          details: error.response?.data || error.message,
        },
      })
    );
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);
