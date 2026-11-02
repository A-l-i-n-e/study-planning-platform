// A separate Vite mode keeps the real API and authentication available.
export const IS_DEMO = import.meta.env.MODE === 'demo';

export const DEMO_NOTICE = 'Демо-версия дипломного проекта. Интерфейс работает на тестовых данных без подключения к серверной части.';
