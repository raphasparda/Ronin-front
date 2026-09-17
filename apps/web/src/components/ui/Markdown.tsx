import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const NEW_TAB_HINT = '(abre em nova aba)';

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-words">
      {children} <span className="sr-only">{NEW_TAB_HINT}</span>
    </a>
  );
}

function Heading({ children }: { children?: ReactNode }) {
  return <p className="text-md font-bold">{children}</p>;
}

/**
 * HTML no texto vira texto (sem `rehype-raw`), o `urlTransform` padrão remove `javascript:` e
 * afins, e imagens viram links (ADR 0007). Títulos do Markdown não entram na hierarquia da página.
 */
const COMPONENTS: Components = {
  a: ({ href, children }) =>
    href ? <ExternalLink href={href}>{children}</ExternalLink> : <span>{children}</span>,
  img: ({ src, alt }) =>
    typeof src === 'string' && src !== '' ? (
      <ExternalLink href={src}>{alt || src}</ExternalLink>
    ) : (
      <span>{alt}</span>
    ),
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border-strong pl-3 text-muted">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-sm bg-surface-sunken px-1 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-sm [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1">
        {children}
      </table>
    </div>
  ),
  input: ({ checked, type }) =>
    type === 'checkbox' ? (
      <input type="checkbox" checked={checked} disabled className="mr-1.5 align-middle" />
    ) : null,
};

export interface MarkdownProps {
  children: string;
  className?: string;
}

/** Markdown do usuário (descrição e comentários) renderizado sem HTML cru. */
export function Markdown({ children, className = '' }: MarkdownProps) {
  return (
    <div className={`flex flex-col gap-2 text-md break-words ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
