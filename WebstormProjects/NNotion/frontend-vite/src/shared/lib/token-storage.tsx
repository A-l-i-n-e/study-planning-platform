import type { AuthUser } from '../types/auth';
import { IS_DEMO } from '../demo/config';

const ACCESS_TOKEN_KEY = IS_DEMO ? 'nnotion:demo:accessToken' : 'accessToken';
const AUTH_USER_KEY = IS_DEMO ? 'nnotion:demo:authUser' : 'authUser';
const storage = () => IS_DEMO ? sessionStorage : localStorage;

export const tokenStorage = {
    getAccessToken(): string | null {
        return storage().getItem(ACCESS_TOKEN_KEY);
    },

    setAccessToken(token: string): void {
        storage().setItem(ACCESS_TOKEN_KEY, token);
    },

    removeAccessToken(): void {
        storage().removeItem(ACCESS_TOKEN_KEY);
    },

    getUser(): AuthUser | null {
        const rawUser = storage().getItem(AUTH_USER_KEY);

        if (!rawUser) {
            return null;
        }

        try {
            const user = JSON.parse(rawUser) as AuthUser;
            return user && ['student', 'teacher', 'admin'].includes(user.role) ? user : null;
        } catch {
            storage().removeItem(AUTH_USER_KEY);
            return null;
        }
    },

    setUser(user: AuthUser): void {
        storage().setItem(AUTH_USER_KEY, JSON.stringify(user));
    },

    clearAuth(): void {
        storage().removeItem(ACCESS_TOKEN_KEY);
        storage().removeItem(AUTH_USER_KEY);
    },
};
