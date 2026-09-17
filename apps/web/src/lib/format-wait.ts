/** "30 segundos", "1 minuto", "2 minutos": tempo de espera para mensagens de 429. */
export function formatWait(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds));
  if (safe < 60) return safe === 1 ? '1 segundo' : `${safe} segundos`;
  const minutes = Math.ceil(safe / 60);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}
