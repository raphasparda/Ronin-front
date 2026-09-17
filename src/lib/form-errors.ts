import type { ErrorDetail } from '@raphasparda/ronin-shared';
import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/** Mensagens da tela por campo e código do issue do Zod (ex.: `too_small`), no tom de screens.md. */
export type FieldMessages<TField extends string> = Partial<
  Record<TField, Partial<Record<z.core.$ZodIssue['code'], string>>>
>;

function asSentence(message: string): string {
  const trimmed = message.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Resolver do React Hook Form a partir do schema Zod compartilhado. Um erro por campo (o
 * primeiro), com a mensagem da tela quando houver e a do schema como alternativa.
 */
export function schemaResolver<TInput extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput, TInput>,
  messages: FieldMessages<Extract<keyof TInput, string>> = {},
): Resolver<TInput, unknown, TOutput> {
  const lookup = messages as Partial<Record<string, Partial<Record<string, string>>>>;

  return (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.map(String).join('.');
      if (field === '' || errors[field]) continue;
      errors[field] = {
        type: issue.code,
        message: lookup[field]?.[issue.code] ?? asSentence(issue.message),
      };
    }
    return { values: {}, errors: errors as FieldErrors<TInput> };
  };
}

/** `body.email` / `email` / `email.0` → `email`. */
export function fieldFromPath(path: string): string {
  const segments = path.split('.').filter(Boolean);
  if (segments[0] === 'body') segments.shift();
  return segments[0] ?? '';
}

export interface SplitDetails<TField extends string> {
  /** Uma mensagem por campo conhecido, na ordem dos `fields` (ordem visual do formulário). */
  fieldErrors: Array<[TField, string]>;
  /** Detalhes que não correspondem a nenhum campo da tela. */
  other: string[];
}

/** Distribui os `details` de um `VALIDATION_ERROR` entre os campos do formulário. */
export function splitErrorDetails<TField extends string>(
  details: readonly ErrorDetail[],
  fields: readonly TField[],
): SplitDetails<TField> {
  const byField = new Map<TField, string>();
  const other: string[] = [];

  for (const detail of details) {
    const field = fields.find((name) => name === fieldFromPath(detail.path));
    if (field === undefined) other.push(asSentence(detail.message));
    else if (!byField.has(field)) byField.set(field, asSentence(detail.message));
  }

  const fieldErrors = fields.flatMap((field): Array<[TField, string]> => {
    const message = byField.get(field);
    return message === undefined ? [] : [[field, message]];
  });
  return { fieldErrors, other };
}

/** "Corrija 1 campo para continuar." / "Corrija 2 campos para continuar." */
export function fixFieldsMessage(count: number): string {
  return count === 1
    ? 'Corrija 1 campo para continuar.'
    : `Corrija ${count} campos para continuar.`;
}
