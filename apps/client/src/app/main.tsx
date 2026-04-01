import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/i18n/config';
import Providers from './providers';
import App from './app';
import './index.css';
import '../styles/receipt-print.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
);
