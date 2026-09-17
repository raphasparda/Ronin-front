import {
  CARD_PRIORITIES,
  NO_PRIORITY_LABEL,
  PRIORITY_LABELS,
  type CardPriority,
  type CardSummary,
  type PaletteColor,
} from '@raphasparda/ronin-shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignLeft,
  Archive,
  ArrowRightLeft,
  Check,
  ExternalLink,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
} from 'lucide-react';
import {
  memo,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEventHandler,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '../../components/ui/Avatar';
import { DueStatePill } from '../../components/ui/DuePill';
import { LabelPill } from '../../components/ui/LabelPill';
import { Menu, MenuGroupLabel, MenuItem, MenuSeparator } from '../../components/ui/Menu';
import { Pill } from '../../components/ui/Pill';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { describeDue, type DueDisplay } from '../../lib/due';
import { displayName } from '../users/users-api';
import { useCardFaceData, type CardFaceData } from './card-face-data';
import { CARD_LINK_STATE, cardPath, isCardJustCreated } from './cards-api';

export interface CardFaceActions {
  onMove: (card: CardSummary) => void;
  onArchive: (card: CardSummary) => void;
  onPriority: (card: CardSummary, priority: CardPriority | null) => void;
  onToggleComplete: (card: CardSummary) => void;
  /** `true` logo após soltar um arraste: o clique que encerra o arraste não abre o card. */
  isClickSuppressed: () => boolean;
}

const MAX_LABELS = 3;
const MAX_AVATARS = 3;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Nome acessível da face (screens §7.3): título, etiquetas, prioridade, prazo, checklist,
 * comentários e responsáveis, tudo em texto.
 */
export function cardFaceLabel(
  card: CardSummary,
  data: CardFaceData,
  due: DueDisplay | null = describeDue(card, data.timeZone, data.now),
): string {
  const labels = card.labelIds.flatMap((id) => data.labelsById.get(id)?.name ?? []);
  const people = card.assigneeIds.map((id) => displayName(data.usersById.get(id)));
  return [
    card.title,
    labels.length > 0 ? `Etiquetas: ${labels.join(', ')}` : null,
    card.priority
      ? `Prioridade ${PRIORITY_LABELS[card.priority].toLocaleLowerCase('pt-BR')}`
      : null,
    due?.spoken,
    card.checklist.total > 0 ? `Checklist ${card.checklist.done} de ${card.checklist.total}` : null,
    card.commentCount > 0 ? plural(card.commentCount, 'comentário', 'comentários') : null,
    people.length > 0
      ? `${people.length === 1 ? 'Responsável' : 'Responsáveis'}: ${people.join(', ')}`
      : null,
    card.hasDescription ? 'Tem descrição' : null,
  ]
    .filter(Boolean)
    .join('. ');
}

const FACE_CLASS =
  'block rounded-lg border border-l-4 border-border bg-surface p-3 text-text no-underline shadow-sm';

function FaceContent({
  card,
  data,
  due,
}: {
  card: CardSummary;
  data: CardFaceData;
  due: DueDisplay | null;
}) {
  const labels = card.labelIds.flatMap((id) => data.labelsById.get(id) ?? []);
  const hiddenLabels = labels.slice(MAX_LABELS);
  const people = card.assigneeIds.map((id) => ({ id, name: displayName(data.usersById.get(id)) }));
  const hiddenPeople = people.slice(MAX_AVATARS);
  const { done, total } = card.checklist;
  const hasPills = card.priority !== null || due !== null;
  const hasMeta = total > 0 || card.commentCount > 0 || card.hasDescription || people.length > 0;

  return (
    <span aria-hidden className="flex flex-col gap-2">
      {labels.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {labels.slice(0, MAX_LABELS).map((label) => (
            <LabelPill key={label.id} label={label} truncate />
          ))}
          {hiddenLabels.length > 0 && (
            <Pill title={hiddenLabels.map((label) => label.name).join(', ')}>
              +{hiddenLabels.length}
            </Pill>
          )}
        </span>
      )}
      <span className="line-clamp-3 font-medium break-words">{card.title}</span>
      {hasPills && (
        <span className="flex flex-wrap gap-1">
          <PriorityBadge priority={card.priority} srPrefix={false} />
          <DueStatePill due={due} />
        </span>
      )}
      {hasMeta && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {total > 0 && (
            <span
              className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                done === total ? 'text-success' : ''
              }`}
            >
              <ListChecks size={14} />
              {done}/{total}
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MessageSquare size={14} />
              {card.commentCount}
            </span>
          )}
          {card.hasDescription && <AlignLeft size={14} />}
          {people.length > 0 && (
            <span className="ml-auto flex -space-x-1">
              {people.slice(0, MAX_AVATARS).map((person) => (
                <Avatar
                  key={person.id}
                  id={person.id}
                  name={person.name}
                  size="sm"
                  className="ring-2 ring-surface"
                />
              ))}
              {hiddenPeople.length > 0 && (
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-pill text-[10px] font-semibold text-on-pill ring-2 ring-surface">
                  +{hiddenPeople.length}
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

const listMark = (color: PaletteColor) => ({ borderLeftColor: `var(--palette-${color}-bg)` });

/** Face do card flutuando sob o ponteiro durante o arraste. */
export function CardFaceOverlay({ card, color }: { card: CardSummary; color: PaletteColor }) {
  const data = useCardFaceData();
  return (
    <div
      aria-hidden
      style={listMark(color)}
      className={`drag-overlay w-full rotate-2 cursor-grabbing shadow-lg ${FACE_CLASS}`}
    >
      <FaceContent card={card} data={data} due={describeDue(card, data.timeZone, data.now)} />
    </div>
  );
}

const PRIORITY_OPTIONS: readonly (CardPriority | null)[] = [
  ...[...CARD_PRIORITIES].reverse(),
  null,
];

interface CardFaceProps {
  card: CardSummary;
  color: PaletteColor;
  readOnly: boolean;
  /** Card otimista, ainda sem id do servidor. */
  pending: boolean;
  actions: CardFaceActions;
}

/**
 * Memoizada: o quadro re-renderiza a cada arraste e mutação otimista; só as faces cujas props
 * mudaram (card, cor, estado) renderizam de novo. `actions` precisa ser estável.
 */
export const CardFace = memo(function CardFace({
  card,
  color,
  readOnly,
  pending,
  actions,
}: CardFaceProps) {
  const navigate = useNavigate();
  const data = useCardFaceData();
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
    disabled: readOnly || pending,
  });

  const justCreated = !pending && isCardJustCreated(card.id);

  if (pending) {
    return (
      <div aria-busy style={listMark(color)} className={`anim-fade-in ${FACE_CLASS} text-muted`}>
        <span className="flex items-start gap-2">
          <LoaderCircle aria-hidden size={14} className="mt-0.5 shrink-0 animate-spin" />
          <span className="line-clamp-3 break-words">{card.title}</span>
          <span className="sr-only">Criando card…</span>
        </span>
      </div>
    );
  }

  const due = describeDue(card, data.timeZone, data.now);
  const to = { pathname: cardPath(card.boardId, card.id), search: data.search };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (actions.isClickSuppressed()) event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    if (!readOnly && plain && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      actions.onMove(card);
    }
  };

  let menu: ReactNode = null;
  if (!readOnly) {
    menu = (
      <div className="absolute top-1.5 right-1.5 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <Menu
          label={`Ações do card ${card.title}`}
          trigger={<MoreHorizontal aria-hidden size={16} />}
          triggerClassName="inline-flex size-10 items-center justify-center rounded-md bg-surface text-muted hover:bg-hover hover:text-text md:size-7"
        >
          <MenuItem
            icon={<ExternalLink size={16} />}
            onSelect={() => void navigate(to, { state: CARD_LINK_STATE })}
          >
            Abrir
          </MenuItem>
          <MenuItem icon={<ArrowRightLeft size={16} />} onSelect={() => actions.onMove(card)}>
            Mover para…
          </MenuItem>
          <MenuItem
            icon={card.status === 'completed' ? <RotateCcw size={16} /> : <Check size={16} />}
            onSelect={() => actions.onToggleComplete(card)}
          >
            {card.status === 'completed' ? 'Reabrir' : 'Concluir'}
          </MenuItem>
          <MenuItem icon={<Archive size={16} />} onSelect={() => actions.onArchive(card)}>
            Arquivar
          </MenuItem>
          <MenuSeparator />
          <MenuGroupLabel>Prioridade</MenuGroupLabel>
          {PRIORITY_OPTIONS.map((priority) => (
            <MenuItem
              key={priority ?? 'none'}
              checked={card.priority === priority}
              onSelect={() => {
                if (card.priority !== priority) actions.onPriority(card, priority);
              }}
            >
              {priority === null ? (
                NO_PRIORITY_LABEL
              ) : (
                <PriorityBadge priority={priority} srPrefix={false} />
              )}
            </MenuItem>
          ))}
        </Menu>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="group relative"
    >
      {/* bubble no card recém-criado fica num wrapper interno: o nó do sortable usa transform */}
      <div className={justCreated ? 'anim-card-bubble' : undefined}>
        {isDragging ? (
          <div
            aria-hidden
            className="rounded-lg border-2 border-dashed border-border-strong bg-surface-sunken p-3 text-transparent"
          >
            <span className="line-clamp-3">{card.title}</span>
          </div>
        ) : (
          <>
            <Link
              to={to}
              state={CARD_LINK_STATE}
              aria-label={cardFaceLabel(card, data, due)}
              aria-keyshortcuts={readOnly ? undefined : 'M'}
              onPointerDown={listeners?.onPointerDown as PointerEventHandler | undefined}
              onClick={onClick}
              onKeyDown={onKeyDown}
              style={listMark(color)}
              className={`focus-inset hover:border-border-strong hover:shadow-md ${
                readOnly ? '' : 'pr-10'
              } ${FACE_CLASS}`}
            >
              <FaceContent card={card} data={data} due={due} />
            </Link>
            {menu}
          </>
        )}
      </div>
    </div>
  );
});
