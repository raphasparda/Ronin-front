import type { ReactNode } from 'react';

import { Logo } from '../../components/layout/Logo';
import { ThemeSwitch } from '../../components/ui/ThemeSwitch';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Cartão centralizado de setup e login (sem cartão abaixo de 640px). */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-text sm:bg-bg">
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <ThemeSwitch />
      </div>
      <main className="flex flex-1 justify-center px-4 pt-4 pb-10 sm:items-center sm:px-6">
        <div className="flex w-full max-w-105 flex-col gap-6 sm:rounded-xl sm:border sm:border-border sm:bg-surface sm:p-8 sm:shadow-sm">
          <div className="flex flex-col gap-3">
            <Logo size="lg" />
            <h1 className="text-2xl">{title}</h1>
            {description && <p className="text-muted">{description}</p>}
          </div>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
