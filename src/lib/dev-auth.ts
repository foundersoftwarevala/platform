/**
 * Development Auth System
 * Provides mock authentication for testing without Supabase
 * Enables browser testing with dev database
 */

interface DevUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'reseller' | 'user';
}

interface DevSession {
  user: DevUser;
  access_token: string;
  expires_at: number;
}

const DEV_USERS = {
  'qa.admin@example.com': {
    id: 'qa-admin-123',
    email: 'qa.admin@example.com',
    name: 'QA Admin',
    role: 'admin',
  },
  'qa.reseller.a@example.com': {
    id: 'qa-reseller-a-456',
    email: 'qa.reseller.a@example.com',
    name: 'QA Reseller A',
    role: 'reseller',
  },
  'qa.reseller.b@example.com': {
    id: 'qa-reseller-b-789',
    email: 'qa.reseller.b@example.com',
    name: 'QA Reseller B',
    role: 'reseller',
  },
};

const STORAGE_KEY = 'dev_session';

export class DevAuth {
  static isDevMode(): boolean {
    return import.meta.env.VITE_USE_DEV_DB === 'true' || typeof window !== 'undefined' && (window as any).__DEV_MODE;
  }

  static login(email: string, password: string = 'password'): DevSession {
    const user = DEV_USERS[email as keyof typeof DEV_USERS];
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    const session: DevSession = {
      user,
      access_token: `dev_token_${user.id}`,
      expires_at: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }

    return session;
  }

  static getSession(): DevSession | null {
    if (typeof window === 'undefined') return null;
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      const session = JSON.parse(stored) as DevSession;
      if (session.expires_at > Date.now()) {
        return session;
      }
      localStorage.removeItem(STORAGE_KEY);
      return null;
    } catch {
      return null;
    }
  }

  static logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  static getUser(): DevUser | null {
    const session = this.getSession();
    return session?.user || null;
  }
}

// Auto-login in dev mode if not already logged in
if (typeof window !== 'undefined' && DevAuth.isDevMode()) {
  if (!DevAuth.getSession()) {
    try {
      DevAuth.login('qa.reseller.a@example.com');
      console.log('[DevAuth] Auto-logged in as Reseller A');
    } catch (e) {
      console.error('[DevAuth] Auto-login failed:', e);
    }
  }
}
