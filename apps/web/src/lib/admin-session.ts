const tokenKey = 'electro-dougaz-admin-token';

export const getAdminToken = () => typeof window === 'undefined' ? null : window.sessionStorage.getItem(tokenKey);
export const setAdminToken = (token: string) => window.sessionStorage.setItem(tokenKey, token);
export const clearAdminToken = () => window.sessionStorage.removeItem(tokenKey);
