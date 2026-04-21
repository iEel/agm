'use client';

import { createContext, useContext } from 'react';
import { type UserRole } from '@/types';

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  companyId?: string;
}

export interface SessionContextType {
  user: SessionUser | null;
  loading: boolean;
  activeEvent: {
    id: string;
    name: string;
    status: string;
    companyName: string;
    companyLogo?: string;
    decimalPrecision?: number;
  } | null;
}

export const SessionContext = createContext<SessionContextType>({
  user: null,
  loading: true,
  activeEvent: null,
});

export const useSession = () => useContext(SessionContext);
