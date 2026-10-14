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

    const token = 
        localStorage.getItem('auth_token') || 
        localStorage.getItem('token') || 
        localStorage.getItem('smt_token') || 
        sessionStorage.getItem('auth_token') || 
        sessionStorage.getItem('smt_token') || 
        sessionStorage.getItem('token');
    const backendUserId = localStorage.getItem('backend_userId');
    let smtUserName = localStorage.getItem('X-User-Name');
    if (!smtUserName) {
        try {
            const userDataStr = localStorage.getItem('user_data');
            if (userDataStr) {
                const parsed = JSON.parse(userDataStr);
                smtUserName = parsed.name || parsed.employee_code || parsed.email || null;
            }
        } catch {}
    }

    // Handle body type correctly (don't set Content-Type for FormData)
    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(backendUserId ? { 'X-Backend-User-Id': backendUserId } : {}),
        ...(smtUserName ? { 'X-User-Name': smtUserName } : {}),
        ...((options.headers as Record<string, string>) || {}),
    };

    if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(finalEndpoint, {
        ...options,
        headers,
    });

    // 304 is NOT an error, it means the browser is using a valid cached response.
    if (!response.ok && response.status !== 304) {
        let errorMsg = `API Error (${response.status})`;
        let errorCode: string | null = null;

        let data: any;
        try {
            const text = await response.text();
            try {
                data = JSON.parse(text);
                errorMsg = data.error || data.message || data.msg || data.err || errorMsg;
                errorCode = data.code || null;
                if (response.status === 409 && errorMsg.startsWith('API Error')) {
                    errorMsg = 'Duplicate scan detected';
                }
            } catch {
                if (text && text.length < 200) errorMsg = text;
            }
        } catch (e) {
            console.error('Failed to parse error response', e);
        }

        if (response.status === 401) {
            // Optional: Logout logic
        }

        // Attach backend error code so callers can branch on it (e.g. MOVE_REQUIRED)
        const err = new Error(errorMsg) as any;
        err.code = errorCode;
        
        // Ensure all structured custom fields are attached directly to the Error object
        if (typeof data !== 'undefined') {
            Object.assign(err, data);
        }

        throw err;
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('Content-Type');
    const isBlob = contentType && (
        contentType.includes('application/octet-stream') ||
        contentType.includes('application/blob') ||
        contentType.includes('application/pdf') ||
        contentType.includes('text/csv') ||
        contentType.includes('application/vnd.openxmlformats-officedocument') ||
        contentType.includes('application/vnd.ms-excel') ||
        contentType.includes('image/')
    );

    if (isBlob) {
        return response.blob();
    }

    return response.json();
}
