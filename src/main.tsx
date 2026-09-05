import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LangProvider } from './context/LangContext.tsx';
import { QueryProvider } from './app/QueryProvider.tsx';
import { AppHashRouter } from './app/RouterBridge.tsx';
import { AppErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryProvider>
        <LangProvider>
          <AppHashRouter>
            <App />
          </AppHashRouter>
        </LangProvider>
      </QueryProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
