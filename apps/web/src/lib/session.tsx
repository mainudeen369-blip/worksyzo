'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { OrgSummary, PublicUser, SessionResponse } from '@worksyzo/shared';
import { api, ApiError } from './api';

interface SessionState {
  user: PublicUser | null;
  organizations: OrgSummary[];
  activeOrg: OrgSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setActiveOrgId: (orgId: string) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);
const ACTIVE_ORG_KEY = 'wsz_active_org';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((session: SessionResponse | null) => {
    if (!session) {
      setUser(null);
      setOrganizations([]);
      setActiveOrgIdState(null);
      return;
    }
    setUser(session.user);
    setOrganizations(session.organizations);
    const stored =
      typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_ORG_KEY) : null;
    const preferred =
      session.organizations.find((o) => o.id === stored)?.id ||
      session.organizations[0]?.id ||
      null;
    setActiveOrgIdState(preferred);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const session = await api<SessionResponse>('/auth/me');
      applySession(session);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        applySession(null);
      } else {
        applySession(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveOrgId = useCallback((orgId: string) => {
    setActiveOrgIdState(orgId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      applySession(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(ACTIVE_ORG_KEY);
      }
    }
  }, [applySession]);

  const activeOrg = useMemo(
    () => organizations.find((o) => o.id === activeOrgId) ?? null,
    [organizations, activeOrgId],
  );

  const value = useMemo(
    () => ({
      user,
      organizations,
      activeOrg,
      loading,
      refresh,
      setActiveOrgId,
      signOut,
    }),
    [user, organizations, activeOrg, loading, refresh, setActiveOrgId, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
