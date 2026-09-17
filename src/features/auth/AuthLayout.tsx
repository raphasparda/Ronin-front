import type { ReactNode } from 'react';

import { BrandWatermark } from '../../components/layout/BrandWatermark';
import { Credit } from '../../components/layout/Credit';
import { Logo } from '../../components/layout/Logo';
import { ThemeSwitch } from '../../components/ui/ThemeSwitch';
import { usePageTransition } from '../../lib/use-page-transition';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * `login`: wallpaper à esquerda (lg+), nuvem de palavras à direita (xl+) e "RONIN" acima
   * da caixa, sem logo dentro dela. As demais telas usam o cartão simples com logo.
   */
  variant?: 'default' | 'login';
}

/** Palavras da nuvem do login: tamanho, peso e cor variam para formar um bloco compacto. */
const LOGIN_WORDS: ReadonlyArray<{ word: string; className: string }> = [
  { word: 'Organização', className: 'text-6xl font-black text-text' },
  { word: 'foco', className: 'text-3xl font-semibold text-muted' },
  { word: 'Clareza', className: 'text-4xl font-bold text-accent' },
  { word: 'equipe', className: 'text-2xl font-medium text-muted' },
  { word: 'Prazos', className: 'text-5xl font-extrabold text-text' },
  { word: 'fluxo', className: 'text-xl font-semibold text-muted' },
  { word: 'Facilidade', className: 'text-5xl font-black text-accent' },
  { word: 'prioridades', className: 'text-2xl font-bold text-text' },
  { word: 'Simples', className: 'text-4xl font-extrabold text-text' },
  { word: 'ritmo', className: 'text-2xl font-medium text-muted' },
  { word: 'Entregas', className: 'text-5xl font-bold text-text' },
  { word: 'kanban', className: 'text-xl font-bold text-accent' },
  { word: 'Controle', className: 'text-3xl font-black text-muted' },
  { word: 'disciplina', className: 'text-3xl font-bold text-text' },
  { word: 'Agilidade', className: 'text-4xl font-black text-text' },
  { word: 'tarefas', className: 'text-xl font-medium text-muted' },
  { word: 'Precisão', className: 'text-5xl font-extrabold text-accent' },
];

function AuthCard({
  title,
  description,
  children,
  footer,
  showLogo,
}: Omit<AuthLayoutProps, 'variant'> & { showLogo: boolean }) {
  // Login, setup, convite e redefinição são rotas separadas: cada uma entra com fade ao montar.
  const cardRef = usePageTransition<HTMLDivElement>('auth', { animateOnMount: true });

  return (
    <div
      ref={cardRef}
      className="flex w-full max-w-105 flex-col gap-6 sm:rounded-xl sm:border sm:border-border sm:bg-surface sm:p-8 sm:shadow-sm"
    >
      <div className="flex flex-col gap-3">
        {showLogo && <Logo size="lg" />}
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="text-muted">{description}</p>}
      </div>
      {children}
      {footer}
    </div>
  );
}

/** Cartão centralizado de setup e login (sem cartão abaixo de 640px). */
export function AuthLayout({ variant = 'default', ...card }: AuthLayoutProps) {
  if (variant === 'login') return <LoginLayout {...card} />;

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-text sm:bg-bg">
      <BrandWatermark />
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <ThemeSwitch />
      </div>
      <main className="relative z-10 flex flex-1 justify-center px-4 pt-4 pb-10 sm:items-center sm:px-6">
        <AuthCard {...card} showLogo />
      </main>
      <Credit className="relative z-10 px-4 pb-4" />
    </div>
  );
}

function LoginLayout(card: Omit<AuthLayoutProps, 'variant'>) {
  return (
    <div className="relative flex min-h-dvh bg-surface text-text sm:bg-bg">
      <div className="absolute top-4 right-4 z-10 sm:right-6">
        <ThemeSwitch />
      </div>
      <div aria-hidden className="relative hidden w-[32%] shrink-0 overflow-hidden lg:block">
        <img
          src="/brand/login-wallpaper.webp"
          alt=""
          width={1254}
          height={1254}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 flex-col items-center px-4 pt-16 pb-10 sm:justify-center sm:px-6">
          <p className="mb-6 pl-[0.4em] text-5xl font-black tracking-[0.4em] text-text sm:text-6xl">
            <span className="text-accent">RO</span>NIN
          </p>
          <AuthCard {...card} showLogo={false} />
        </main>
        <Credit className="px-4 pb-4" />
      </div>

      <div
        aria-hidden
        className="hidden w-[30%] shrink-0 items-center justify-center px-8 select-none xl:flex"
      >
        <p className="flex max-w-md flex-wrap items-baseline justify-center gap-x-3 leading-[0.95] tracking-tight">
          {LOGIN_WORDS.map(({ word, className }) => (
            <span key={word} className={`${className} leading-[0.95]`}>
              {word}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
