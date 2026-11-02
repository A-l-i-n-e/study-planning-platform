import axios from 'axios';
import { tokenStorage } from '../lib/token-storage';
import { IS_DEMO } from '../demo/config';

const LOGIN_PATH = '/login';

export const api = axios.create({
    baseURL: IS_DEMO ? undefined : import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
    // Load the local adapter only when demo mode is active.
    ...(IS_DEMO ? { adapter: async (config) => (await import('../demo/adapter')).demoAdapter(config) } : {}),
});

api.interceptors.request.use((config) => {
    const token = tokenStorage.getAccessToken();

    if (!IS_DEMO && token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (!IS_DEMO && axios.isAxiosError(error) && error.response?.status === 401) {
            tokenStorage.clearAuth();

            if (window.location.pathname !== LOGIN_PATH) {
                window.location.assign(LOGIN_PATH);
            }
        }

        return Promise.reject(error);
    }
);
