import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { toast } from '../components/ui/toast-store';
import { resetAdminDb } from './admin-handlers';
import { resetBoardDb } from './board-handlers';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  toast.clear();
  resetAdminDb();
  resetBoardDb();
  window.localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'light');
});

afterAll(() => server.close());
