import type { CompletionChange } from '@raphasparda/ronin-shared';

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

/** Cards restritos (scope §11.11). O cadeado sempre vem com texto (RN17). */
export const RESTRICTION_MESSAGES = {
  lockedBadge: 'Card restrito',
  lockedFace: (title: string) => `Card restrito: ${title}. Você não tem acesso.`,
  lockedClick:
    'Card restrito. Só quem está na lista de acesso pode abrir. Fale com quem participa do card ou com um administrador.',
  lockedDrag: 'Card restrito. Você não pode mover este card.',
  lockedArchived: 'Você não tem acesso a este card.',
  noAccessTitle: 'Você não tem acesso a este card',
  lostAccess: 'Você não tem mais acesso a este card.',
  panelTitle: 'Quem pode ver este card',
  team: 'Visível para a equipe',
  teamHelp: 'Todos os membros podem abrir, editar e comentar.',
  restricted: 'Restrito a pessoas específicas',
  restrictedHelp: 'Só quem estiver na lista (e os administradores) pode abrir o card.',
  restrictedWarning:
    'O card continua aparecendo no quadro para todo mundo, com o título e um cadeado. Evite informação sensível no título.',
  adminsAlways: 'Administradores sempre têm acesso.',
  adminOutsideList: 'Você vê este card porque é administrador.',
  emptyList:
    'Este card restrito está sem pessoas. Adicione alguém ou torne o card visível para a equipe.',
  assigneeBadge: 'Responsável',
  addPerson: 'Adicionar pessoa',
  searchPerson: 'Buscar pessoa',
  noPeopleFound: 'Ninguém encontrado com esse nome.',
  removeAccess: (name: string) => `Remover acesso de ${name}`,
  restrictedNow: (count: number) =>
    count === 1
      ? 'Card restrito. 1 pessoa tem acesso.'
      : `Card restrito. ${count} pessoas têm acesso.`,
  teamNow: 'Card visível para a equipe.',
  added: (name: string) => `${name} agora tem acesso a este card.`,
  removed: (name: string) => `${name} não tem mais acesso a este card.`,
  assigneeGainedAccess: (name: string) =>
    `${name} foi adicionada aos responsáveis e ganhou acesso a este card.`,
  isAssignee: (name: string) =>
    `${name} é responsável por este card. Remova a pessoa dos responsáveis antes de tirar o acesso.`,
  lastPerson:
    'A lista precisa ter pelo menos uma pessoa. Adicione alguém ou torne o card visível para a equipe.',
  leaveTitle: 'Tirar o seu acesso a este card?',
  leaveDescription:
    'Você não vai mais conseguir abrir o card, e só quem ficou na lista ou um administrador pode devolver o acesso.',
  leaveConfirm: 'Sair do card',
  boardArchived: 'Este quadro está arquivado. Restaure o quadro para mudar quem vê este card.',
  notRestricted: 'Este card voltou a ser visível para a equipe.',
  userNotActive: 'Essa pessoa foi desativada e não pode receber acesso.',
  visibilityFailed: 'Não foi possível alterar quem vê este card. Tente de novo.',
  viewerFailed: 'Não foi possível alterar a lista de acesso. Tente de novo.',
  filterNote:
    'Cards restritos aos quais você não tem acesso não entram nos filtros de responsável, etiqueta, prioridade e prazo.',
} as const;

/** Capa do card (scope §11.11). */
export const COVER_MESSAGES = {
  add: 'Adicionar capa',
  replace: 'Trocar capa',
  remove: 'Remover capa',
  help: 'JPEG, PNG ou WebP, até 5 MB.',
  choose: 'Escolher um arquivo de imagem',
  uploading: (percent: number | null) =>
    percent === null ? 'Enviando capa…' : `Enviando capa… ${percent}%`,
  added: 'Capa adicionada.',
  replaced: 'Capa trocada.',
  removed: 'Capa removida.',
  confirmRemoveTitle: 'Remover a capa deste card?',
  confirmRemoveDescription: 'A imagem é apagada e não dá para desfazer.',
  wrongType: 'Formato não aceito. Use JPEG, PNG ou WebP.',
  tooLarge: (megabytes: string) => `A imagem tem ${megabytes} MB. O limite é 5 MB.`,
  unreadable: 'Não conseguimos ler esta imagem. Tente outro arquivo.',
  uploadFailed: 'Não foi possível enviar a capa. Tente de novo.',
  removeFailed: 'Não foi possível remover a capa. Tente de novo.',
  loadFailed: 'Não foi possível carregar a capa.',
  reload: 'Recarregar',
  boardArchived: 'Este quadro está arquivado. Restaure o quadro para mudar a capa.',
  storageUnavailable: 'As capas de card não estão disponíveis agora.',
  detailAlt: 'Capa do card',
} as const;
