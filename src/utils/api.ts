export async function apiFetch(
    endpoint: string,
    options: RequestInit = {}
) {
    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    // Ensure endpoint starts with / if not provided, but allow full URLs if absolutely necessary (though we discourage it)
    // We want to force relative paths mostly.
    const url = endpoint.startsWith('http') ? endpoint : endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorMsg = 'API error';
        try {
            const data = await response.json();
            errorMsg = data.message || errorMsg;
        } catch {
            // If json parsing fails, try text
            try {
                const text = await response.text();
                if (text) errorMsg = text;
            } catch { }
        }
        throw new Error(errorMsg);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }

    // Handle Blob response for downloads
    if (options.headers && (options.headers as any)['Accept'] === 'application/blob') {
        return response.blob();
    }

    return response.json();
}
