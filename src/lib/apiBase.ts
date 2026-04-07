// Base URL for API calls.
// In development (local server): empty string (relative paths work fine).
// In production (GitHub Pages → Railway): set VITE_API_URL to Railway URL.
export const API_BASE = (import.meta.env.VITE_API_URL as string) || '';
