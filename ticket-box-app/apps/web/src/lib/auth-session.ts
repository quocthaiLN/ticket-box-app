export type AuthRole = "AUDIENCE" | "ORGANIZER" | "CHECKER" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: AuthRole;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
};

export type AuthSession = {
  accessToken: string;
  expiresAt: number;
  user: AuthUser;
};

const sessionKey = "ticketbox.auth.session";
export const authSessionChangedEvent = "ticketbox:auth-session-changed";

export function getStoredAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(sessionKey);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AuthSession;
    if (!session.accessToken || !session.user || session.expiresAt <= Date.now()) {
      clearAuthSession();
      return null;
    }
    return session;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getAccessToken(): string | null {
  return getStoredAuthSession()?.accessToken ?? null;
}

export function storeAuthSession(input: {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}) {
  const session: AuthSession = {
    accessToken: input.accessToken,
    expiresAt: Date.now() + input.expiresIn * 1000,
    user: input.user,
  };
  localStorage.setItem(sessionKey, JSON.stringify(session));
  dispatchAuthSessionChanged();
}

export function clearAuthSession() {
  localStorage.removeItem(sessionKey);
  dispatchAuthSessionChanged();
}

function dispatchAuthSessionChanged() {
  window.dispatchEvent(new Event(authSessionChangedEvent));
}
