import '@fontsource-variable/figtree/wght.css';
import './styles/globals.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { Toaster } from './components/ui/Toast';
import { createQueryClient } from './lib/query-client';
import { createAppRouter, redirectToLogin } from './router';

const router = createAppRouter();

const queryClient = createQueryClient({ onUnauthenticated: () => redirectToLogin(router) });

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado.');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
