import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAccessToken } from "./supabase";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      if (window.location.pathname !== '/auth') {
        window.location.href = '/auth';
      }
      throw new Error('401: Unauthorized');
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const pathSegments: string[] = [];
    const params = new URLSearchParams();

    for (const segment of queryKey) {
      if (typeof segment === 'object' && segment !== null && !Array.isArray(segment)) {
        for (const [key, value] of Object.entries(segment)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
      } else if (segment !== undefined && segment !== null) {
        const segmentStr = String(segment);
        pathSegments.push(segmentStr.startsWith('/') ? segmentStr : '/' + segmentStr);
      }
    }

    let url = pathSegments.join('');
    const queryString = params.toString();
    if (queryString) {
      url += '?' + queryString;
    }

    const authHeaders = await getAuthHeaders();
    const res = await fetch(url, {
      credentials: "include",
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
