import {
  BOARD_FILTER_PARAMS,
  boardFilterToParams,
  EMPTY_BOARD_FILTER,
  isBoardFilterActive,
  parseBoardFilter,
  type BoardFilter,
} from '@kanban/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

const FILTER_PARAM_NAMES = new Set<string>(Object.values(BOARD_FILTER_PARAMS));

/** Número de critérios preenchidos (o "(N)" do botão Filtros). */
export function countActiveCriteria(filter: BoardFilter): number {
  return [
    filter.assigneeIds.length > 0,
    filter.labelIds.length > 0,
    filter.priorities.length > 0,
    filter.due.length > 0,
    filter.text.trim() !== '',
  ].filter(Boolean).length;
}

/**
 * Filtro do quadro na query string (overview §9): `?responsavel=&etiqueta=&prioridade=&prazo=&q=`.
 * Trocar o filtro substitui a entrada do histórico (não empilha um "voltar" por clique).
 */
export function useBoardFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const key = searchParams.toString();

  const filter = useMemo(
    () => parseBoardFilter(Object.fromEntries(new URLSearchParams(key))),
    [key],
  );

  const setFilter = useCallback(
    (next: BoardFilter) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams();
          for (const [name, value] of current) {
            if (!FILTER_PARAM_NAMES.has(name)) params.append(name, value);
          }
          for (const [name, value] of Object.entries(boardFilterToParams(next))) {
            params.set(name, value);
          }
          return params;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setSearchParams],
  );

  const clear = useCallback(() => setFilter(EMPTY_BOARD_FILTER), [setFilter]);

  return { filter, setFilter, clear, active: isBoardFilterActive(filter) };
}
