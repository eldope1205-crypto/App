const BASE_URL = import.meta.env.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
  : '';
const API_BASE = `${BASE_URL}/api`;

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

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    throw new Error('Error de red al conectar con GREY IA. Por favor, verifica tu conexión a internet.');
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let errorMsg = data?.error;
    if (!errorMsg) {
      if (typeof data === 'string' && data.includes('NOT_FOUND')) {
        errorMsg = 'El endpoint de autenticación no está disponible o la ruta es incorrecta (404 NOT_FOUND).';
      } else if (typeof data === 'string' && data.length < 200 && data.trim()) {
        errorMsg = data.trim();
      } else {
        errorMsg = `Error en el servidor (${response.status}: ${response.statusText || 'Error no especificado'}).`;
      }
    }
    throw new Error(errorMsg);
  }

  return data;
}
