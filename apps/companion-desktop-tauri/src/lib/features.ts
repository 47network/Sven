/**
 * Tauri desktop feature services — thin wrappers over the gateway-api
 * REST endpoints for E2EE, calls, media, presence, and search.
 *
 * All calls go through standard fetch() with the auth token header.
 * The SSE stream handles real-time events; these are for on-demand operations.
 */

// ── Helpers ──────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

async function apiPost<T = unknown>(
    gatewayUrl: string,
    path: string,
    token: string,
    body?: unknown,
): Promise<T> {
    const res = await fetch(`${gatewayUrl}${path}`, {
        method: 'POST',
        headers: authHeaders(token),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path}: ${res.status}`);
    const json = await res.json();
    return (json.data ?? json) as T;
}

async function apiGet<T = unknown>(
    gatewayUrl: string,
    path: string,
    token: string,
): Promise<T> {
    const res = await fetch(`${gatewayUrl}${path}`, {
        method: 'GET',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    const json = await res.json();
    return (json.data ?? json) as T;
}

async function apiPut<T = unknown>(
    gatewayUrl: string,
    path: string,
    token: string,
    body?: unknown,
): Promise<T> {
    const res = await fetch(`${gatewayUrl}${path}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`PUT ${path}: ${res.status}`);
    const json = await res.json();
    return (json.data ?? json) as T;
}

async function apiPatch<T = unknown>(
    gatewayUrl: string,
    path: string,
    token: string,
    body?: unknown,
): Promise<T> {
    const res = await fetch(`${gatewayUrl}${path}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`PATCH ${path}: ${res.status}`);
    const json = await res.json();
    return (json.data ?? json) as T;
}

// ── E2EE ─────────────────────────────────────────────────────

export interface DeviceKeys {
    device_id: string;
    identity_key: string;
    signing_key: string;
    one_time_keys: string[];
}

export interface QueriedDevice {
    device_id: string;
    identity_key: string;
    signing_key: string;
}

export interface ClaimedKey {
    device_id: string;
    key_type: string;
    key_data: string;
}

export const e2ee = {
    uploadKeys: (gw: string, token: string, keys: DeviceKeys) =>
        apiPost(gw, '/v1/e2ee/keys/upload', token, keys),

    queryKeys: (gw: string, token: string, userIds: string[]) =>
        apiPost<Record<string, QueriedDevice[]>>(gw, '/v1/e2ee/keys/query', token, { user_ids: userIds }),

    claimKeys: (gw: string, token: string, claims: Record<string, string>) =>
        apiPost<Record<string, ClaimedKey>>(gw, '/v1/e2ee/keys/claim', token, { claims }),

    getKeyCount: (gw: string, token: string) =>
        apiGet<{ count: number }>(gw, '/v1/e2ee/keys/count', token),

    backupRoomKeys: (gw: string, token: string, roomId: string, sessions: unknown[]) =>
        apiPut(gw, '/v1/e2ee/room-keys', token, { room_id: roomId, sessions }),

    getRoomKeys: (gw: string, token: string, roomId: string) =>
        apiGet(gw, `/v1/e2ee/room-keys?room_id=${encodeURIComponent(roomId)}`, token),
};

// ── Calls (WebRTC Signaling) ─────────────────────────────────

export interface IceServer {
    urls: string[];
    username?: string;
    credential?: string;
}

export interface CallStart {
    call_id: string;
    ice_servers: IceServer[];
    status?: string;
}

export interface CallJoin {
    call_id: string;
    participants: Array<{ user_id: string; status: string; display_name?: string; media_state?: Record<string, boolean> }>;
    ice_servers: IceServer[];
}

export const calls = {
    start: (gw: string, token: string, chatId: string, callType: 'voice' | 'video' = 'voice') =>
        apiPost<CallStart>(gw, '/v1/calls', token, { chat_id: chatId, call_type: callType }),

    join: (gw: string, token: string, callId: string) =>
        apiPost<CallJoin>(gw, `/v1/calls/${callId}/join`, token),

    signal: (gw: string, token: string, callId: string, payload: {
        type: string;
        target_user_id: string;
        sdp?: string;
        candidate?: Record<string, unknown>;
    }) => apiPost(gw, `/v1/calls/${callId}/signal`, token, payload),

    updateMedia: (gw: string, token: string, callId: string, state: {
        audio?: boolean;
        video?: boolean;
        screen?: boolean;
    }) => apiPatch(gw, `/v1/calls/${callId}/media`, token, state),

    leave: (gw: string, token: string, callId: string) =>
        apiPost(gw, `/v1/calls/${callId}/leave`, token),

    decline: (gw: string, token: string, callId: string) =>
        apiPost(gw, `/v1/calls/${callId}/decline`, token),

    getState: (gw: string, token: string, callId: string) =>
        apiGet(gw, `/v1/calls/${callId}`, token),

    listActive: (gw: string, token: string, chatId: string) =>
        apiGet<{ calls: Array<{ id: string; call_type: string; status: string; participant_count: number }> }>(
            gw, `/v1/chats/${chatId}/calls`, token),

    getIceConfig: (gw: string, token: string) =>
        apiGet<{ ice_servers: IceServer[] }>(gw, '/v1/calls/ice-config', token),
};

// ── Media ────────────────────────────────────────────────────

export interface MediaUpload {
    id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    checksum?: string;
    thumbnail_path?: string;
    created_at?: string;
}

export const media = {
    /** Upload a file (uses FormData + fetch directly). */
    upload: async (gw: string, token: string, file: File, chatId?: string): Promise<MediaUpload> => {
        const fd = new FormData();
        fd.append('file', file);
        if (chatId) fd.append('chat_id', chatId);

        const res = await fetch(`${gw}/v1/media/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const json = await res.json();
        return (json.data ?? json) as MediaUpload;
    },

    downloadUrl: (gw: string, mediaId: string) =>
        `${gw}/v1/media/${mediaId}/download`,

    thumbnailUrl: (gw: string, mediaId: string, w?: number, h?: number) => {
        const params = new URLSearchParams();
        if (w) params.set('w', String(w));
        if (h) params.set('h', String(h));
        const qs = params.toString();
        return `${gw}/v1/media/${mediaId}/thumbnail${qs ? `?${qs}` : ''}`;
    },

    attach: (gw: string, token: string, mediaId: string, messageId: string, displayOrder = 0) =>
        apiPost(gw, '/v1/media/attach', token, { media_id: mediaId, message_id: messageId, display_order: displayOrder }),

    gallery: (gw: string, token: string, chatId: string, opts?: { type?: string; limit?: number; offset?: number }) =>
        apiGet<{ items: MediaUpload[]; total: number }>(
            gw, `/v1/chats/${chatId}/media?limit=${opts?.limit ?? 50}&offset=${opts?.offset ?? 0}${opts?.type ? `&type=${opts.type}` : ''}`, token),
};

// ── Presence / Typing / Read Receipts ────────────────────────

export const presence = {
    sendTyping: (gw: string, token: string, chatId: string, isTyping = true) =>
        apiPost(gw, `/v1/chats/${chatId}/typing`, token, { is_typing: isTyping }),

    markRead: (gw: string, token: string, chatId: string, messageId: string) =>
        apiPost(gw, `/v1/chats/${chatId}/read`, token, { message_id: messageId }),

    getReadReceipts: (gw: string, token: string, chatId: string) =>
        apiGet<{ receipts: Array<{ user_id: string; last_read_message_id: string; display_name?: string; read_at?: string }> }>(
            gw, `/v1/chats/${chatId}/read-receipts`, token),

    getUnreadCounts: (gw: string, token: string) =>
        apiGet<{ chats: Array<{ chat_id: string; unread_count: number; chat_name?: string }> }>(
            gw, '/v1/chats/unread', token),

    setStatus: (gw: string, token: string, status: 'online' | 'away' | 'busy' | 'offline', statusMessage?: string) =>
        apiPut(gw, '/v1/presence', token, { status, ...(statusMessage ? { status_message: statusMessage } : {}) }),

    queryPresence: (gw: string, token: string, userIds: string[]) =>
        apiPost<{ users: Array<{ user_id: string; status: string; status_message?: string; last_active?: string }> }>(
            gw, '/v1/presence/query', token, { user_ids: userIds }),
};

// ── Search ───────────────────────────────────────────────────

export interface SearchResult {
    message_id?: string;
    id?: string;
    chat_id: string;
    text?: string;
    headline?: string;
    sender_name?: string;
    sent_at?: string;
    score?: number;
}

export const search = {
    messages: (gw: string, token: string, query: string, opts?: { chat_id?: string; limit?: number; offset?: number }) =>
        apiPost<{ results: SearchResult[]; total: number }>(
            gw, '/v1/search/messages', token, { query, ...opts }),

    semantic: (gw: string, token: string, query: string, opts?: { chat_id?: string; limit?: number; min_score?: number }) =>
        apiPost<{ results: SearchResult[]; total: number }>(
            gw, '/v1/search/semantic', token, { query, ...opts }),

    unified: (gw: string, token: string, query: string, opts?: { types?: string[]; limit?: number }) =>
        apiPost<{
            messages: SearchResult[];
            files: Array<{ media_id: string; file_name: string; mime_type?: string; chat_id?: string }>;
            contacts: Array<{ user_id: string; display_name: string; email?: string }>;
        }>(gw, '/v1/search/unified', token, { query, ...opts }),
};
