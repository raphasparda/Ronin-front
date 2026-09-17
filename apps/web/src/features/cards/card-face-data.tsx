import type { Label, UserSummary } from '@kanban/shared';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useNow } from '../../lib/use-now';
import { useSession } from '../auth/auth-api';
import { useUsers } from '../users/users-api';

export interface CardFaceData {
  labelsById: ReadonlyMap<string, Label>;
  usersById: ReadonlyMap<string, UserSummary>;
  timeZone: string | undefined;
  now: Date;
  /** Query string do quadro (filtro), mantida nos links para o detalhe. */
  search: string;
}

const EMPTY: CardFaceData = {
  labelsById: new Map(),
  usersById: new Map(),
  timeZone: undefined,
  now: new Date(0),
  search: '',
};

const CardFaceDataContext = createContext<CardFaceData>(EMPTY);

export function useCardFaceData(): CardFaceData {
  return useContext(CardFaceDataContext);
}

interface CardFaceDataProviderProps {
  labels: readonly Label[];
  search: string;
  children: ReactNode;
}

/** Dados que toda face do quadro usa (etiquetas, pessoas, fuso e hora atual), calculados uma vez. */
export function CardFaceDataProvider({ labels, search, children }: CardFaceDataProviderProps) {
  const users = useUsers();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const now = useNow();

  const value = useMemo<CardFaceData>(
    () => ({
      labelsById: new Map(labels.map((label) => [label.id, label])),
      usersById: new Map((users.data ?? []).map((user) => [user.id, user])),
      timeZone,
      now,
      search,
    }),
    [labels, users.data, timeZone, now, search],
  );

  return <CardFaceDataContext value={value}>{children}</CardFaceDataContext>;
}
