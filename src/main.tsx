import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// Global Error Monitoring
window.onerror = function(message, source, lineno, colno, error) {
  console.error("GLOBAL ERROR CAPTURED:", { message, source, lineno, colno, error });
};

window.onunhandledrejection = function(event) {
  console.error("UNHANDLED PROMISE REJECTION:", event.reason);
};

import { AuthProvider } from './contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
