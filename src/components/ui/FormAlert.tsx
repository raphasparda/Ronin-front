import { Alert } from './Alert';

/**
 * Região `role="alert"` sempre presente no formulário, para que leitores de tela anunciem a
 * mensagem quando ela aparece. Vazia, não ocupa espaço.
 */
export function FormAlert({ message }: { message: string | null }) {
  return <div role="alert">{message && <Alert className="mb-4">{message}</Alert>}</div>;
}
