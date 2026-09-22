/**
 * App version shown in Settings → About. A build can inject VITE_APP_VERSION (e.g. from package.json);
 * otherwise this constant (keep it equal to package.json "version") is used.
 */
const FALLBACK = '1.0.0'
const env = (import.meta.env as Record<string, string | undefined>).VITE_APP_VERSION

export const APP_VERSION: string = (typeof env === 'string' && env.trim()) || FALLBACK
