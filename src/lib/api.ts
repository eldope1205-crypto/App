const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('grey_ia_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('grey_ia_token', token);
  } else {
    localStorage.removeItem('grey_ia_token');
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || (typeof data === 'string' ? data : `Error HTTP ${response.status}`);
    throw new Error(errorMsg);
  }

  return data;
}
