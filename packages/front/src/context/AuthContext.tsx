import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AuthUser {
  id: string;
  username: string;
  isAdmin?: boolean;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  setupUser: (username: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user] = useState<AuthUser | null>(() => {
    // Default local user - not fetched from server
    return { id: 'local', username: 'Local User', isAdmin: true };
  });
  const [isLoading] = useState(false);

  // In local single-user mode, we're always authenticated
  const isAuthenticated = true;

  const setupUser = useCallback(async (_username: string): Promise<void> => {
    // No-op: single-user mode
  }, []);

  const updateUsername = useCallback(async (_username: string): Promise<void> => {
    // No-op
  }, []);

  const logout = useCallback((): void => {
    // No-op for local mode
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    // No-op
  }, []);

  const value: AuthContextType = {
    user,
    token: 'local-mode',
    isLoading,
    isAuthenticated,
    setupUser,
    updateUsername,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
