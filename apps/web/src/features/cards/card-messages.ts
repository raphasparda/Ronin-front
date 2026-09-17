import type { CompletionChange } from '@kanban/shared';

const plural = (count: number, one: string, many: string) =>
  count === 1 ? `1 ${one}` : `${count} ${many}`;

export function completionSuffix(change: CompletionChange | null): string {
  if (change === 'completed') return ' Card concluído.';
  if (change === 'reopened') return ' Card reaberto.';
  return '';
}

export const CARD_MESSAGES = {
  created: (listName: string) => `Card criado em ${listName}.`,
  createFailed:
    'Não foi possível criar o card. O texto continua no campo para você tentar de novo.',
  emptyTitle: 'O título não pode ficar vazio.',
  titleFailed: 'Não foi possível salvar o título. Tente de novo.',
  descriptionFailed: 'Não foi possível salvar a descrição. Tente de novo.',
  moveFailed: 'Não foi possível mover o card. Ele voltou para onde estava.',
  destinationArchived: 'A lista de destino foi arquivada. Escolha outra lista.',
  moved: (listName: string, position: number) =>
    `Card movido para ${listName}, posição ${position}.`,
  movedToBoard: (boardName: string, removedLabels: number) =>
    `Card movido para ${boardName}.${
      removedLabels > 0
        ? ` ${plural(removedLabels, 'etiqueta foi removida', 'etiquetas foram removidas')}.`
        : ''
    }`,
  completed: 'Card concluído.',
  completedMoved: (listName: string) => `Card concluído e movido para ${listName}.`,
  reopened: 'Card reaberto.',
  reopenedMoved: (listName: string) => `Card reaberto e movido para o topo de ${listName}.`,
  completionUndone: (listName: string) => `Conclusão desfeita. O card voltou para ${listName}.`,
  reopenedStayed: (listName: string) =>
    `Card reaberto. Ele continua em ${listName} porque o quadro não tem outra lista.`,
  completeFailed: 'Não foi possível concluir o card. Tente de novo.',
  reopenFailed: 'Não foi possível reabrir o card. Tente de novo.',
  completionArchived: 'Este card foi arquivado. Restaure o card para concluir ou reabrir.',
  completedBy: (name: string, when: string) => `por ${name} em ${when}`,
  archived: 'Card arquivado.',
  archiveFailed: 'Não foi possível arquivar o card. Tente de novo.',
  restored: (listName: string) => `Card restaurado no fim de ${listName}.`,
  restoredCompleted: (listName: string) =>
    `Card restaurado em ${listName} e marcado como concluído.`,
  restoreFailed: 'Não foi possível restaurar o card. Tente de novo.',
  restoreListFirst: (listName: string) => `Restaure a lista ${listName} primeiro.`,
  deleted: 'Card excluído.',
  deleteFailed: 'Não foi possível excluir o card. Tente de novo.',
  linkCopied: 'Link do card copiado.',
  linkCopyFailed: 'Não foi possível copiar. Copie o endereço da página manualmente.',
  priorityChanged: (label: string) => `Prioridade alterada para ${label}.`,
  priorityRemoved: 'Prioridade removida.',
  priorityFailed: 'Não foi possível alterar a prioridade. Tente de novo.',
  priorityHelp: 'A prioridade não muda a ordem dos cards no quadro.',
  dueSaved: 'Prazo salvo.',
  dueRemoved: 'Prazo removido.',
  dueFailed: 'Não foi possível salvar o prazo. Tente de novo.',
  assigneeFailed: 'Não foi possível alterar os responsáveis. Tente de novo.',
  assigneeInactive: 'Essa pessoa foi desativada e não pode ser atribuída.',
  labelToggleFailed: 'Não foi possível alterar as etiquetas do card. Tente de novo.',
  notFound: 'Card não encontrado',
  notFoundDescription: 'Ele pode ter sido excluído.',
} as const;
