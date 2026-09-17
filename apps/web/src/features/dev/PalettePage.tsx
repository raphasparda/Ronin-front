import { CARD_PRIORITIES, NO_PRIORITY_LABEL, PALETTE, PALETTE_LABELS } from '@kanban/shared';
import { Archive, Calendar, Check, Clock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../components/ui/Button';
import { ColorSwatch } from '../../components/ui/ColorSwatch';
import { Input } from '../../components/ui/Input';
import { Pill, type PillStatus } from '../../components/ui/Pill';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { toast } from '../../components/ui/toast-store';
import type { Theme } from '../../lib/theme';

const PRIORITIES_HIGH_FIRST = [...CARD_PRIORITIES].reverse();

const STATUSES: { status: PillStatus; icon: ReactNode; label: string }[] = [
  { status: 'scheduled', icon: <Calendar size={12} />, label: '20 set' },
  { status: 'due-soon', icon: <Clock size={12} />, label: 'Vence hoje, 18:00' },
  { status: 'overdue', icon: <TriangleAlert size={12} />, label: 'Atrasado' },
  { status: 'done', icon: <Check size={12} />, label: 'Concluído' },
  { status: 'archived', icon: <Archive size={12} />, label: 'Arquivado' },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function ThemePanel({ theme }: { theme: Theme }) {
  const title = theme === 'light' ? 'Tema claro' : 'Tema escuro';

  return (
    <div
      data-theme={theme}
      className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-bg p-4 text-text md:p-5"
    >
      <h2 className="text-lg">{title}</h2>

      <Group title="Listas">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PALETTE.map((color) => (
            <li
              key={color}
              className="overflow-hidden rounded-lg border border-border bg-surface-sunken"
            >
              <div
                data-color={color}
                className="flex h-10 items-center justify-between gap-2 bg-(--c-bg) px-3 font-semibold text-(--c-fg)"
              >
                <span className="truncate">{PALETTE_LABELS[color]}</span>
                <span className="text-xs">3</span>
              </div>
              <div className="p-2">
                <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
                  Card em {PALETTE_LABELS[color].toLowerCase()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Etiquetas">
        <ul className="flex flex-wrap gap-2">
          {PALETTE.map((color) => (
            <li key={color}>
              <Pill color={color}>{PALETTE_LABELS[color]}</Pill>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Amostras">
        <ul className="flex flex-wrap gap-3">
          {PALETTE.map((color, index) => (
            <li key={color}>
              <ColorSwatch color={color} selected={index === 6} />
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Prioridades">
        <ul className="flex flex-wrap items-center gap-2">
          {PRIORITIES_HIGH_FIRST.map((priority) => (
            <li key={priority}>
              <PriorityBadge priority={priority} />
            </li>
          ))}
          <li className="text-muted">{NO_PRIORITY_LABEL}</li>
        </ul>
      </Group>

      <Group title="Estados de prazo e card">
        <ul className="flex flex-wrap gap-2">
          {STATUSES.map(({ status, icon, label }) => (
            <li key={status}>
              <Pill status={status} icon={icon}>
                {label}
              </Pill>
            </li>
          ))}
          <li>
            <Pill>12 cards</Pill>
          </li>
        </ul>
      </Group>

      <Group title="Texto">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
          <p>Texto principal</p>
          <p className="text-muted">Texto secundário</p>
          <p>
            <a href="#paleta">Link de destaque</a>
          </p>
          <p className="text-danger">Mensagem de erro</p>
          <p className="text-warning">Mensagem de aviso</p>
          <p className="text-success">Mensagem de sucesso</p>
        </div>
      </Group>

      <Group title="Botões">
        <div className="flex flex-wrap gap-2">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Excluir</Button>
          <Button disabled>Desabilitado</Button>
          <Button loading loadingText="Salvando…">
            Salvar
          </Button>
          <Button size="sm" variant="secondary">
            Pequeno
          </Button>
        </div>
      </Group>

      <Group title="Campos">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome do quadro" placeholder="Ex.: Sprint 12" hint="Até 100 caracteres." />
          <Input
            label="E-mail"
            defaultValue="nome@"
            error="Digite um e-mail válido, como nome@empresa.com."
          />
        </div>
      </Group>
    </div>
  );
}

export function PalettePage() {
  return (
    <div id="paleta" className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <title>Paleta · Ronin</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl">Paleta</h1>
        <p className="max-w-2xl text-muted">
          Página interna (só em desenvolvimento) para revisar cores de listas e etiquetas,
          prioridades e estados nos dois temas. Os valores vêm de <code>globals.css</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => toast.success('Card concluído.')}>
            Toast de sucesso
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.error('Algo deu errado. Tente de novo.')}
          >
            Toast de erro
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.info('Card reaberto e movido para o topo de A fazer.', {
                label: 'Desfazer',
                onClick: () => toast.info('Ação desfeita.'),
              })
            }
          >
            Toast com ação
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ThemePanel theme="light" />
        <ThemePanel theme="dark" />
      </div>
    </div>
  );
}
