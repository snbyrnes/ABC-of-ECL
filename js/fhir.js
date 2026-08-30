/**
 * FHIR terminology client.
 *
 * Wraps ValueSet/$expand and CodeSystem/$lookup, adds bearer auth for servers
 * that need it, and turns FHIR OperationOutcome responses into messages a
 * person can act on rather than a wall of JSON.
 */

import { getAccessToken, invalidateToken } from './auth.js';

export const DEFAULT_PAGE_SIZE = 100;
export const SEARCH_PAGE_SIZE = 20;

/** Error carrying a classification the UI can branch on. */
export class TerminologyError extends Error {
    constructor(message, code, detail) {
        super(message);
        this.name = 'TerminologyError';
        this.code = code;
        this.detail = detail || null;
    }
}

/**
 * Build the implicit ValueSet URL for an ECL expression.
 *
 * The expression must be percent-encoded here, not just left to URLSearchParams.
 * Ontoserver decodes the `url` parameter and then splits the canonical URL on
 * `|` to find a version, so an unencoded pipe in a term makes it report
 * "Invalid version format for SNOMED". Encoding once satisfies both Ontoserver
 * and the HSE NMPC server.
 */
function eclValueSetUrl(ecl) {
    return 'http://snomed.info/sct?fhir_vs=ecl/' + encodeURIComponent(ecl);
}

/** Pull the most useful human-readable line out of an OperationOutcome. */
function describeOutcome(payload, status) {
    if (payload && Array.isArray(payload.issue) && payload.issue.length) {
        const issue = payload.issue.find(i => i.diagnostics) || payload.issue[0];
        const text = issue.diagnostics
            || (issue.details && (issue.details.text || (issue.details.coding || [])[0]?.display))
            || issue.code;
        if (text) return String(text);
    }
    return `The server returned HTTP ${status}.`;
}

/**
 * Classify a failed response so the UI can say something specific.
 * ECL syntax problems come back as 400 with a parser message; those are the
 * ones worth showing verbatim, because the user wrote the thing that broke.
 */
function classify(status, diagnostics) {
    if (status === 400 || status === 422) {
        return { code: 'ECL_INVALID', message: 'That ECL expression could not be parsed.' };
    }
    if (status === 401 || status === 403) {
        return { code: 'UNAUTHORISED', message: 'The server refused the request. Your session may have expired.' };
    }
    if (status === 404) {
        return { code: 'NOT_FOUND', message: 'The server has no content at that address.' };
    }
    if (status === 429) {
        return { code: 'RATE_LIMITED', message: 'The server is rate limiting requests. Wait a moment and try again.' };
    }
    if (status >= 500) {
        return { code: 'SERVER_ERROR', message: 'The terminology server had an internal error. This is usually temporary.' };
    }
    return { code: 'REQUEST_FAILED', message: diagnostics };
}

async function request(server, path, params, { signal, retryOnAuth = true } = {}) {
    const url = new URL(server.fhirBase + path);
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) value.forEach(v => url.searchParams.append(key, v));
        else url.searchParams.set(key, value);
    }

    const headers = { Accept: 'application/fhir+json' };
    const token = await getAccessToken(server);
    if (token) headers.Authorization = 'Bearer ' + token;

    let response;
    try {
        response = await fetch(url, { headers, signal });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new TerminologyError(
            `Could not reach ${server.name}. Check your network connection, or try the public server instead.`,
            'NETWORK'
        );
    }

    // A rejected token usually means it expired early; drop it and retry once.
    if ((response.status === 401 || response.status === 403) && token && retryOnAuth) {
        invalidateToken(server.id);
        return request(server, path, params, { signal, retryOnAuth: false });
    }

    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON body */ }

    if (!response.ok) {
        const diagnostics = describeOutcome(payload, response.status);
        const { code, message } = classify(response.status, diagnostics);
        throw new TerminologyError(message, code, diagnostics);
    }

    return payload;
}

/**
 * Expand an ECL expression.
 * Returns { concepts, total, offset, hasMore }.
 */
export async function expandEcl(server, ecl, { offset = 0, count = DEFAULT_PAGE_SIZE, filter, signal } = {}) {
    const payload = await request(server, '/ValueSet/$expand', {
        url: eclValueSetUrl(ecl),
        count,
        offset,
        filter,
        displayLanguage: 'en'
    }, { signal });

    const expansion = payload?.expansion || {};
    const concepts = expansion.contains || [];
    // `total` is optional in FHIR; fall back to what we can prove.
    const total = typeof expansion.total === 'number' ? expansion.total : offset + concepts.length;

    return {
        concepts,
        total,
        offset,
        hasMore: offset + concepts.length < total
    };
}

/** Search for concepts within a constraint, for the picker inputs. */
export async function searchConcepts(server, term, ecl = '*', { signal, count = SEARCH_PAGE_SIZE } = {}) {
    const result = await expandEcl(server, ecl, { filter: term, count, signal });
    return result.concepts;
}

/** Look up a single concept's preferred term. Returns null if not found. */
export async function lookupConcept(server, code, { signal } = {}) {
    try {
        const payload = await request(server, '/CodeSystem/$lookup', {
            system: 'http://snomed.info/sct',
            code
        }, { signal });
        const params = payload?.parameter || [];
        const display = params.find(p => p.name === 'display');
        return display ? display.valueString : null;
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        return null;
    }
}

/** Read the SNOMED edition/version the server is currently serving. */
export async function fetchEditionVersion(server, { signal } = {}) {
    try {
        const payload = await request(server, '/CodeSystem/$lookup', {
            system: 'http://snomed.info/sct',
            code: '138875005'
        }, { signal });
        const params = payload?.parameter || [];
        const version = params.find(p => p.name === 'version');
        return version ? version.valueString : null;
    } catch (e) {
        return null;
    }
}
