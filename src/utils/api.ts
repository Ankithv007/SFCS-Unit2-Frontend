/**
 * Shared API utility for making requests to the backend via Nginx proxy.
 * All paths must be relative (e.g., '/api/auth/login').
 */
export async function apiFetch(
    endpoint: string,
    options: RequestInit = {}
) {
    // 1. Convert any absolute URLs to relative paths (Sanity Check)
    if (endpoint.startsWith('http')) {
        try {
            const url = new URL(endpoint);
            endpoint = url.pathname + url.search;
        } catch (e) {
            // Invalid URL, let it fail naturally
        }
    }

    // 2. Ensure leading slash
    let finalEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // 3. DO NOT automatically prepend /api. 
    // The components are responsible for sending /api/auth, /api/qc, etc.
    // Prepending automatically causes "/api/api" bugs if not careful.

    const token = localStorage.getItem('auth_token');

    // Handle body type correctly (don't set Content-Type for FormData)
    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
    };

    if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(finalEndpoint, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorMsg = 'API error';
        try {
            const data = await response.json();
            errorMsg = data.message || errorMsg;
        } catch {
            try {
                const text = await response.text();
                if (text) errorMsg = text;
            } catch { }
        }

        if (response.status === 401) {
            // Optional: Logout logic
        }

        throw new Error(errorMsg);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType && (contentType.includes('application/octet-stream') || contentType.includes('application/blob') || contentType.includes('image/'))) {
        return response.blob();
    }

    return response.json();
}
