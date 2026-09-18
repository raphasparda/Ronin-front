/**
 * Quadros restritos e capa do quadro (Fatia 11, ADR 0015 e 0016).
 * O cadeado nunca aparece sozinho: sempre acompanhado de texto.
 */
export const RESTRICTION_MESSAGES = {
  lockedBadge: 'Quadro restrito',
  lockedTile: (name: string) => `Quadro restrito: ${name}. Você não tem acesso.`,
  lockedClick:
    'Quadro restrito. Só quem está na lista de acesso pode abrir. Fale com quem participa do quadro ou com um administrador.',
  noAccessTitle: 'Você não tem acesso a este quadro',
  lostAccess: 'Você não tem mais acesso a este quadro.',
  backToBoards: 'Voltar para Quadros',

  panelTitle: 'Quem pode ver este quadro',
  menuItem: 'Quem pode ver este quadro…',
  team: 'Visível para a equipe',
  teamHelp: 'Todos os membros podem abrir, editar e comentar.',
  restricted: 'Restrito a pessoas específicas',
  restrictedHelp: 'Só quem estiver na lista (e os administradores) pode abrir o quadro.',
  restrictedWarning:
    'O quadro continua aparecendo na lista de quadros para todo mundo, com o nome e um cadeado. Evite informação sensível no nome.',
  adminsAlways: 'Administradores sempre têm acesso.',
  adminOutsideList: 'Você vê este quadro porque tem perfil de administração.',
  emptyList:
    'Este quadro restrito está sem pessoas. Adicione alguém ou torne o quadro visível para a equipe.',

  addPerson: 'Adicionar pessoa',
  searchPerson: 'Buscar pessoa',
  loadingPeople: 'Carregando pessoas…',
  noPeopleFound: 'Ninguém encontrado com esse nome.',
  removeAccess: (name: string) => `Remover acesso de ${name}`,
  restrictedNow: (count: number) =>
    count === 1
      ? 'Quadro restrito. 1 pessoa tem acesso.'
      : `Quadro restrito. ${count} pessoas têm acesso.`,
  teamNow: 'Quadro visível para a equipe.',
  added: (name: string) => `${name} agora tem acesso a este quadro.`,
  removed: (name: string) => `${name} não tem mais acesso a este quadro.`,
  leaveTitle: 'Tirar o seu acesso a este quadro?',
  leaveDescription:
    'Você não vai mais conseguir abrir o quadro, e só quem ficou na lista ou um administrador pode devolver o acesso.',
  leaveConfirm: 'Sair do quadro',

  boardArchived: 'Este quadro está arquivado. Restaure o quadro para mudar quem vê este quadro.',
  notRestricted: 'Este quadro voltou a ser visível para a equipe.',
  userNotActive: 'Essa pessoa foi desativada e não pode receber acesso.',
  visibilityFailed: 'Não foi possível alterar quem vê este quadro. Tente de novo.',
  viewerFailed: 'Não foi possível alterar a lista de acesso. Tente de novo.',
} as const;

/** Capa do quadro (Fatia 11, ADR 0016). */
export const COVER_MESSAGES = {
  menuItem: 'Capa do quadro…',
  dialogTitle: 'Capa do quadro',
  add: 'Adicionar capa',
  replace: 'Trocar capa',
  remove: 'Remover capa',
  help: 'JPEG, PNG ou WebP, até 5 MB.',
  none: 'Este quadro não tem capa.',
  uploading: (percent: number | null) =>
    percent === null ? 'Enviando capa…' : `Enviando capa… ${percent}%`,
  cancelUpload: 'Cancelar envio',
  added: 'Capa adicionada.',
  replaced: 'Capa trocada.',
  removed: 'Capa removida.',
  removing: 'Removendo…',
  confirmRemoveTitle: 'Remover a capa deste quadro?',
  confirmRemoveDescription: 'A imagem é apagada e não dá para desfazer.',
  wrongType: 'Formato não aceito. Use JPEG, PNG ou WebP.',
  tooLarge: (megabytes: string) => `A imagem tem ${megabytes} MB. O limite é 5 MB.`,
  unreadable: 'Não conseguimos ler esta imagem. Tente outro arquivo.',
  uploadFailed: 'Não foi possível enviar a capa. Tente de novo.',
  removeFailed: 'Não foi possível remover a capa. Tente de novo.',
  loadFailed: 'Não foi possível carregar a capa.',
  reload: 'Recarregar',
  boardArchived: 'Este quadro está arquivado. Restaure o quadro para mudar a capa.',
  storageUnavailable: 'As capas de quadro não estão disponíveis agora.',
  alt: 'Capa do quadro',
} as const;
