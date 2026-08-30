/**
 * Authentication for terminology servers that require it.
 *
 * ABC of ECL is a fully static site served from a public repository, so it can
 * never hold a client secret of its own. Instead each visitor supplies their
 * own credentials, which are kept in that visitor's browser and sent only to
 * the token endpoint declared by the selected server.
 *
 * Credentials go to sessionStorage by default, so closing the tab forgets them.
 * "Remember on this device" promotes them to localStorage.
 *
 * The OAuth2 client_credentials grant is used because that is what the HSE
 * NMPC Keycloak realm issues to service clients today. The realm also supports
 * authorization_code with PKCE, which needs no secret at all; when a public
 * client is registered, add a branch here and prefer it.
 */

const CRED_PREFIX = 'ecl.creds.';

/** In-memory token cache, keyed by server id. Never persisted. */
const tokenCache = new Map();

function stores() {
    const out = [];
    try { out.push(window.sessionStorage); } catch (e) { /* blocked */ }
    try { out.push(window.localStorage); } catch (e) { /* blocked */ }
    return out;
}

/** Read stored credentials for a server. Returns null when absent. */
export function getCredentials(serverId) {
    for (const store of stores()) {
        try {
            const raw = store.getItem(CRED_PREFIX + serverId);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.clientId && parsed.clientSecret) return parsed;
        } catch (e) { /* try the next store */ }
    }
    return null;
}

export function hasCredentials(serverId) {
    return getCredentials(serverId) !== null;
}

/** True when the credentials will survive closing the tab. */
export function isRemembered(serverId) {
    try {
        return localStorage.getItem(CRED_PREFIX + serverId) !== null;
    } catch (e) {
        return false;
    }
}

export function setCredentials(serverId, clientId, clientSecret, { remember = false } = {}) {
    const payload = JSON.stringify({
        clientId: String(clientId).trim(),
        clientSecret: String(clientSecret).trim()
    });
    // Always clear both first, so switching "remember" off really does downgrade.
    clearCredentials(serverId);
    try {
        (remember ? localStorage : sessionStorage).setItem(CRED_PREFIX + serverId, payload);
    } catch (e) {
        throw new Error('This browser is blocking storage, so credentials cannot be saved. Check your privacy settings.');
    }
    tokenCache.delete(serverId);
}

export function clearCredentials(serverId) {
    for (const store of stores()) {
        try { store.removeItem(CRED_PREFIX + serverId); } catch (e) { /* ignore */ }
    }
    tokenCache.delete(serverId);
}

/** Forget the cached access token without forgetting the credentials. */
export function invalidateToken(serverId) {
    tokenCache.delete(serverId);
}

/** True when a usable token is already held, so the UI can skip a round trip. */
export function hasLiveToken(serverId) {
    const cached = tokenCache.get(serverId);
    return Boolean(cached && cached.expiresAt - 60000 > Date.now());
}

/**
 * Return a valid bearer token for a server, fetching one if needed.
 * Resolves to null for servers that need no authentication.
 * Throws with a readable message when credentials are missing or rejected.
 */
export async function getAccessToken(server) {
    if (!server.auth || server.auth.type === 'none') return null;

    const cached = tokenCache.get(server.id);
    // Refresh 60s early so a token cannot expire mid-request.
    if (cached && cached.expiresAt - 60000 > Date.now()) {
        return cached.token;
    }

    const creds = getCredentials(server.id);
    if (!creds) {
        const err = new Error(`Sign in to ${server.name} to run queries.`);
        err.code = 'NO_CREDENTIALS';
        err.serverId = server.id;
        throw err;
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', creds.clientId);
    body.set('client_secret', creds.clientSecret);
    if (server.auth.scope) body.set('scope', server.auth.scope);

    let response;
    try {
        response = await fetch(server.auth.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
    } catch (e) {
        const err = new Error(`Could not reach the ${server.name} sign-in service. Check your network connection.`);
        err.code = 'TOKEN_NETWORK';
        err.serverId = server.id;
        throw err;
    }

    let payload = {};
    try { payload = await response.json(); } catch (e) { /* leave empty */ }

    if (!response.ok || !payload.access_token) {
        const detail = payload.error_description || payload.error || `HTTP ${response.status}`;
        const rejected = response.status === 401 || payload.error === 'invalid_client'
            || payload.error === 'unauthorized_client';
        const err = new Error(
            rejected
                ? 'That client ID or secret was not accepted. Check both and try again.'
                : `Sign-in failed: ${detail}`
        );
        err.code = rejected ? 'TOKEN_REJECTED' : 'TOKEN_ERROR';
        err.serverId = server.id;
        throw err;
    }

    const lifetimeMs = (Number(payload.expires_in) || 300) * 1000;
    tokenCache.set(server.id, {
        token: payload.access_token,
        expiresAt: Date.now() + lifetimeMs
    });

    return payload.access_token;
}

/** Verify a pair of credentials without storing them. Throws on rejection. */
export async function testCredentials(server, clientId, clientSecret) {
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: String(clientId).trim(),
        client_secret: String(clientSecret).trim()
    });
    if (server.auth.scope) body.set('scope', server.auth.scope);

    let response;
    try {
        response = await fetch(server.auth.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
    } catch (e) {
        const err = new Error(`Could not reach the ${server.name} sign-in service. Check your network connection.`);
        err.code = 'TOKEN_NETWORK';
        throw err;
    }

    let payload = {};
    try { payload = await response.json(); } catch (e) { /* leave empty */ }

    if (!response.ok || !payload.access_token) {
        const rejected = response.status === 401 || payload.error === 'invalid_client'
            || payload.error === 'unauthorized_client';
        const err = new Error(
            rejected
                ? 'That client ID or secret was not accepted. Check both and try again.'
                : `Sign-in failed: ${payload.error_description || payload.error || `HTTP ${response.status}`}`
        );
        err.code = rejected ? 'TOKEN_REJECTED' : 'TOKEN_ERROR';
        throw err;
    }
    return payload;
}
