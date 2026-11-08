import { apiRequest, ApiError } from './api';
import { clearAdminToken, getAdminToken } from './admin-session';

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new ApiError('Session expirée. Reconnectez-vous.', 401);
  try {
    return await apiRequest<T>(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) clearAdminToken();
    throw error;
  }
}
