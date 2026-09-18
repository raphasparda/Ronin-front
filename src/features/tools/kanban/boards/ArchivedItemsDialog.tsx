import type { ArchivedCard, BoardPayload, List } from '@raphasparda/ronin-shared';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Dialog } from '../../../../components/ui/Dialog';
import { Pill } from '../../../../components/ui/Pill';
import { ListSkeleton, LoadError } from '../../../../components/ui/QueryState';
import { tabPanelProps, Tabs } from '../../../../components/ui/Tabs';
import { toast } from '../../../../components/ui/toast-store';
import { useSessionUser } from '../../../platform/auth/auth-api';
import { CARD_MESSAGES } from '../cards/card-messages';
import { useDeleteCard } from '../cards/cards-api';
import { useCardArchiving } from '../cards/use-card-actions';
import { useBoardErrorHandler } from './board-errors';
import { LIST_MESSAGES } from './BoardLists';
import { useArchivedItems, useRestoreList } from './boards-api';

type Tab = 'cards' | 'lists';

interface ArchivedItemsDialogProps {
  payload: BoardPayload;
  open: boolean;
  readOnly: boolean;
  onClose: () => void;
}

interface ArchivedCardRowProps {
  card: ArchivedCard;
  doneList: boolean;
  listColor: List['color'] | undefined;
  readOnly: boolean;
  isAdmin: boolean;
  restoring: boolean;
  onRestore: () => void;
  onDelete: () => void;
}

function ArchivedCardRow({
  card,
  doneList,
  listColor,
  readOnly,
  isAdmin,
  restoring,
  onRestore,
  onDelete,
}: ArchivedCardRowProps) {
  const hintId = useId();
  const hint = card.listArchived
    ? CARD_MESSAGES.restoreListFirst(card.listName)
    : doneList && card.status === 'open'
      ? `Ao restaurar, o card volta para ${card.listName} e é marcado como concluído.`
      : null;

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-medium break-words">{card.title}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill color={listColor}>{card.listName}</Pill>
          <Pill status="archived" icon={<Archive size={12} />}>
            Arquivado
          </Pill>
        </span>
        {hint && (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={<RotateCcw size={14} />}
          aria-label={`Restaurar card ${card.title}`}
          aria-describedby={hint ? hintId : undefined}
          disabled={readOnly || card.listArchived}
          loading={restoring}
          onClick={onRestore}
        >
          Restaurar
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Trash2 size={14} />}
            aria-label={`Excluir card ${card.title}`}
            disabled={readOnly}
            onClick={onDelete}
          >
            Excluir
          </Button>
        )}
      </div>
    </li>
  );
}

/** "Itens arquivados…" (screens §7.7): abas Cards e Listas, com restaurar e excluir (Admin). */
export function ArchivedItemsDialog({
  payload,
  open,
  readOnly,
  onClose,
}: ArchivedItemsDialogProps) {
  const boardId = payload.board.id;
  const [tab, setTab] = useState<Tab>('cards');
  const [deleting, setDeleting] = useState<ArchivedCard | null>(null);
  const idPrefix = useId();
  const isAdmin = useSessionUser()?.role === 'admin';
  const items = useArchivedItems(boardId, open);
  const restoreList = useRestoreList(boardId);
  const archiving = useCardArchiving(boardId);
  const deleteCard = useDeleteCard(boardId);
  const handleError = useBoardErrorHandler(boardId);

  const activeList = (listId: string) => payload.lists.find((list) => list.id === listId);

  let content: ReactNode;
  if (items.isPending) {
    content = <ListSkeleton label="Carregando itens arquivados…" rows={2} />;
  } else if (items.isError) {
    content = <LoadError onRetry={() => void items.refetch()} retrying={items.isFetching} />;
  } else if (tab === 'cards') {
    content =
      items.data.cards.length === 0 ? (
        <p className="text-muted">Nenhum card arquivado.</p>
      ) : (
        <ul aria-label="Cards arquivados" className="flex flex-col divide-y divide-border">
          {items.data.cards.map((card) => (
            <ArchivedCardRow
              key={card.id}
              card={card}
              doneList={activeList(card.listId)?.isDoneList ?? false}
              listColor={activeList(card.listId)?.color}
              readOnly={readOnly}
              isAdmin={isAdmin}
              restoring={archiving.restoringId === card.id}
              onRestore={() => archiving.restore({ card, listName: card.listName })}
              onDelete={() => setDeleting(card)}
            />
          ))}
        </ul>
      );
  } else {
    content =
      items.data.lists.length === 0 ? (
        <p className="text-muted">Nenhuma lista arquivada.</p>
      ) : (
        <ul aria-label="Listas arquivadas" className="flex flex-col divide-y divide-border">
          {items.data.lists.map((list) => (
            <li key={list.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <Pill color={list.color} className="max-w-full">
                  <span className="truncate">{list.name}</span>
                </Pill>
              </span>
              <Button
                size="sm"
                variant="secondary"
                icon={<RotateCcw size={14} />}
                aria-label={`Restaurar lista ${list.name}`}
                disabled={readOnly}
                loading={restoreList.isPending && restoreList.variables === list.id}
                onClick={() =>
                  restoreList.mutate(list.id, {
                    onSuccess: () => toast.success(LIST_MESSAGES.restored),
                    onError: (error) =>
                      handleError(error, 'Não foi possível restaurar a lista. Tente de novo.'),
                  })
                }
              >
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      );
  }

  return (
    <>
      <Dialog
        open={open}
        title="Itens arquivados"
        size="md"
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        }
      >
        <Tabs
          label="Tipo de item"
          idPrefix={idPrefix}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'cards', label: 'Cards' },
            { id: 'lists', label: 'Listas' },
          ]}
        />
        <div {...tabPanelProps(idPrefix, tab)}>{content}</div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        tone="danger"
        title="Excluir o card definitivamente?"
        description={<p>Não dá para desfazer.</p>}
        confirmLabel="Excluir card"
        pending={deleteCard.isPending}
        pendingLabel="Excluindo…"
        onConfirm={() =>
          deleting &&
          deleteCard.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast.success(CARD_MESSAGES.deleted);
            },
            onError: (error) => {
              setDeleting(null);
              handleError(error, CARD_MESSAGES.deleteFailed);
            },
          })
        }
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
