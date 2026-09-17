export function isBoardsSection(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/quadros') || pathname.startsWith('/b/');
}

export function isMyCardsSection(pathname: string): boolean {
  return pathname.startsWith('/meus-cards');
}
