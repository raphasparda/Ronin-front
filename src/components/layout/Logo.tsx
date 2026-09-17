import { Link } from 'react-router';

type LogoSize = 'md' | 'lg';

const markSize: Record<LogoSize, { px: number; className: string; text: string }> = {
  md: { px: 32, className: 'size-8', text: 'text-lg' },
  lg: { px: 48, className: 'size-12', text: 'text-2xl' },
};

function LogoMark({ size }: { size: LogoSize }) {
  const s = markSize[size];
  return (
    <>
      {/* Decorativa: o nome "Ronin" ao lado já dá o nome acessível. */}
      <img
        src="/brand/ronin-logo-128.png"
        srcSet="/brand/ronin-logo-64.png 64w, /brand/ronin-logo-128.png 128w, /brand/ronin-logo-256.png 256w"
        sizes={`${s.px}px`}
        width={s.px}
        height={s.px}
        alt=""
        aria-hidden
        className={`${s.className} shrink-0 object-contain`}
      />
      <span className={`${s.text} font-bold`}>Ronin</span>
    </>
  );
}

/** Marca do app. Com `asLink`, leva para Quadros. */
export function Logo({ asLink = false, size = 'md' }: { asLink?: boolean; size?: LogoSize }) {
  if (!asLink) {
    return (
      <span className="flex items-center gap-2 text-text">
        <LogoMark size={size} />
      </span>
    );
  }

  return (
    <Link
      to="/"
      aria-label="Ronin, ir para Quadros"
      className="flex items-center gap-2 rounded-md text-text no-underline"
    >
      <LogoMark size={size} />
    </Link>
  );
}
