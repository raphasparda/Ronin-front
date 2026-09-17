import {
  completionChangeOnMove,
  sortByPosition,
  type BoardPayload,
  type CardSummary,
} from '@kanban/shared';
import { CircleCheck, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Pill } from '../../components/ui/Pill';
import { Select } from '../../components/ui/Select';
import { useBoard, useBoards } from '../boards/boards-api';
import { placementAtPosition } from './card-drag';
import { cardsInList, usePendingCardIds, type MoveCardVariables } from './cards-api';

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

export function labelsWarning(names: readonly string[], boardName: string): string {
  return names.length === 1
    ? `A etiqueta ${names[0]} não existe em ${boardName} e será removida do card.`
    : `As etiquetas ${joinNames(names)} não existem em ${boardName} e serão removidas do card.`;
}

function positionLabel(position: number, total: number, current: number | null): string {
  const notes = [
    position === 1 && total > 1 ? 'início' : null,
    position === total && total > 1 ? 'final' : null,
    position === current ? 'atual' : null,
  ].filter(Boolean);
  return notes.length > 0 ? `${position} (${notes.join(', ')})` : String(position);
}

interface MoveCardFormProps {
  card: CardSummary;
  source: BoardPayload;
  onMove: (variables: MoveCardVariables) => void;
  onClose: () => void;
}

function MoveCardForm({ card, source, onMove, onClose }: MoveCardFormProps) {
  const [boardId, setBoardId] = useState(card.boardId);
  const [listId, setListId] = useState(card.listId);
  const [position, setPosition] = useState<number | null>(null);

  const boards = useBoards(false);
  const crossBoard = boardId !== source.board.id;
  const targetQuery = useBoard(boardId, { paused: true });
  const target = crossBoard ? targetQuery.data : source;
  const pendingIds = usePendingCardIds(boardId);

  const boardOptions = (boards.data ?? [source.board])
    .filter((board) => board.archivedAt === null)
    .map((board) => ({ value: board.id, label: board.name }));
  if (!boardOptions.some((option) => option.value === source.board.id)) {
    boardOptions.unshift({ value: source.board.id, label: source.board.name });
  }
  const targetBoardName =
    boardOptions.find((option) => option.value === boardId)?.label ?? target?.board.name ?? '';

  const lists = sortByPosition(target?.lists ?? []);
  const targetList = lists.find((list) => list.id === listId) ?? lists[0];
  const siblings = targetList
    ? cardsInList(target?.cards ?? [], targetList.id).filter((item) => item.id !== card.id)
    : [];
  const total = siblings.length + 1;
  const sameList = !crossBoard && targetList?.id === card.listId;
  const currentPosition = sameList
    ? cardsInList(source.cards, card.listId).findIndex((item) => item.id === card.id) + 1
    : null;
  const chosenPosition = Math.min(position ?? currentPosition ?? total, total);

  const sourceList = source.lists.find((list) => list.id === card.listId);
  const completionChange = targetList
    ? completionChangeOnMove({
        status: card.status,
        fromListIsDone: sourceList?.isDoneList ?? false,
        toListIsDone: targetList.isDoneList,
      })
    : null;
  const labelNames = crossBoard
    ? card.labelIds.flatMap((id) => source.labels.find((label) => label.id === id)?.name ?? [])
    : [];

  const unchanged = sameList && chosenPosition === currentPosition;
  const canMove = targetList !== undefined && !unchanged;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canMove || !targetList) return;
    onMove({
      card,
      toBoard: { id: boardId, name: targetBoardName },
      toList: { id: targetList.id, name: targetList.name },
      placement: placementAtPosition(
        siblings.map((item) => item.id),
        chosenPosition,
        card.id,
        pendingIds,
      ),
      position: chosenPosition,
      source: 'dialog',
    });
    onClose();
  };

  let listField: ReactNode;
  if (crossBoard && targetQuery.isPending) {
    listField = <p className="text-muted">Carregando listas…</p>;
  } else if (crossBoard && targetQuery.isError) {
    listField = (
      <div className="flex flex-col items-start gap-2">
        <p className="text-danger">Não foi possível carregar as listas deste quadro.</p>
        <Button
          variant="secondary"
          size="sm"
          loading={targetQuery.isFetching}
          loadingText="Tentando…"
          onClick={() => void targetQuery.refetch()}
        >
          Tentar de novo
        </Button>
      </div>
    );
  } else if (lists.length === 0) {
    listField = <p className="text-muted">Este quadro não tem listas.</p>;
  } else {
    listField = (
      <>
        <Select
          label="Lista"
          value={targetList?.id ?? ''}
          options={lists.map((list) => ({
            value: list.id,
            label: list.isDoneList ? `${list.name} (lista de conclusão)` : list.name,
          }))}
          onChange={(event) => {
            setListId(event.target.value);
            setPosition(null);
          }}
        />
        {targetList && (
          <p className="-mt-2 flex items-center gap-2 text-xs text-muted">
            Destino:
            <Pill color={targetList.color}>{targetList.name}</Pill>
          </p>
        )}
        <Select
          label="Posição"
          value={String(chosenPosition)}
          options={Array.from({ length: total }, (_, index) => ({
            value: String(index + 1),
            label: positionLabel(index + 1, total, currentPosition),
          }))}
          onChange={(event) => setPosition(Number(event.target.value))}
        />
      </>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Select
        label="Quadro"
        value={boardId}
        options={boardOptions}
        onChange={(event) => {
          setBoardId(event.target.value);
          setListId('');
          setPosition(null);
        }}
      />
      {listField}

      <div aria-live="polite" className="flex flex-col gap-2">
        {labelNames.length > 0 && (
          <p className="flex items-start gap-2 text-warning">
            <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
            {labelsWarning(labelNames, targetBoardName)}
          </p>
        )}
        {completionChange === 'completed' && targetList && (
          <p className="flex items-start gap-2">
            <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0 text-success" />
            Mover para {targetList.name} conclui o card.
          </p>
        )}
        {completionChange === 'reopened' && (
          <p className="flex items-start gap-2">
            <RotateCcw aria-hidden size={16} className="mt-0.5 shrink-0" />
            Tirar o card de {sourceList?.name} reabre o card.
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canMove}>
          Mover
        </Button>
      </div>
    </form>
  );
}

export interface MoveCardDialogProps {
  card: CardSummary | null;
  source: BoardPayload | undefined;
  onMove: (variables: MoveCardVariables) => void;
  onClose: () => void;
}

/** "Mover para…" (screens §7.5): quadro, lista e posição 1..n+1, com avisos de etiquetas e conclusão. */
export function MoveCardDialog({ card, source, onMove, onClose }: MoveCardDialogProps) {
  return (
    <Dialog open={card !== null && source !== undefined} title="Mover card" onClose={onClose}>
      {card && source && (
        <MoveCardForm key={card.id} card={card} source={source} onMove={onMove} onClose={onClose} />
      )}
    </Dialog>
  );
}
