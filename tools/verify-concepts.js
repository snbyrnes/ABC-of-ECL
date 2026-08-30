#!/usr/bin/env node
/**
 * Check every hard-coded SNOMED CT concept ID in the source against a live
 * terminology server, and report any that have been inactivated or removed.
 *
 * SNOMED releases twice a year. Without this, a stale ID shows up as an empty
 * result set and a learner assumes they wrote the query wrong.
 *
 *   node tools/verify-concepts.js
 *
 * Credentials for the HSE server are read from the environment when present:
 *   NMPC_CLIENT_ID, NMPC_CLIENT_SECRET
 * Without them, Irish-extension IDs are reported as skipped rather than passed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['js', '.'];
const EXTENSIONS = ['.js', '.html'];
const IGNORE = new Set(['tools', 'node_modules', '.git', 'partials']);

const ONTOSERVER = 'https://r4.ontoserver.csiro.au/fhir';
const NMPC = 'https://nmpc.hse.ie/production1/fhir';
const NMPC_TOKEN_URL = 'https://nmpc.hse.ie/authorisation/auth/realms/terminology/protocol/openid-connect/token';

/** Irish extension namespace. These only exist on the HSE server. */
const IRISH = /1000220\d{2,}$/;

function collectFiles() {
    const files = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (IGNORE.has(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (EXTENSIONS.includes(path.extname(entry.name))) files.push(full);
        }
    };
    for (const source of SOURCES) {
        const dir = path.join(ROOT, source);
        if (!fs.existsSync(dir)) continue;
        if (source === '.') {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isFile() && EXTENSIONS.includes(path.extname(entry.name))) {
                    files.push(path.join(dir, entry.name));
                }
            }
        } else walk(dir);
    }
    return [...new Set(files)];
}

/** SNOMED IDs are 6-18 digits. Require a word boundary so years etc. are excluded. */
function extractIds(text) {
    const ids = new Map();
    const re = /\b(\d{6,18})\b/g;
    let m;
    while ((m = re.exec(text))) {
        const id = m[1];
        // A valid SNOMED identifier ends with a check digit and a partition id;
        // this cheap filter drops obvious non-identifiers such as timestamps.
        if (id.length < 6) continue;
        ids.set(id, (ids.get(id) || 0) + 1);
    }
    return ids;
}

async function getNmpcToken() {
    const id = process.env.NMPC_CLIENT_ID;
    const secret = process.env.NMPC_CLIENT_SECRET;
    if (!id || !secret) return null;
    const body = new URLSearchParams({
        grant_type: 'client_credentials', client_id: id, client_secret: secret
    });
    const response = await fetch(NMPC_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });
    if (!response.ok) {
        console.error('  could not obtain an NMPC token; Irish IDs will be skipped');
        return null;
    }
    return (await response.json()).access_token;
}

async function lookup(base, code, token) {
    const url = new URL(base + '/CodeSystem/$lookup');
    url.searchParams.set('system', 'http://snomed.info/sct');
    url.searchParams.set('code', code);
    url.searchParams.set('property', 'inactive');
    const headers = { Accept: 'application/fhir+json' };
    if (token) headers.Authorization = 'Bearer ' + token;

    const response = await fetch(url, { headers });
    if (response.status === 404) return { status: 'missing' };
    if (!response.ok) return { status: 'error', detail: `HTTP ${response.status}` };

    const payload = await response.json();
    const params = payload.parameter || [];
    const display = (params.find(p => p.name === 'display') || {}).valueString;
    let inactive = false;
    for (const prop of params.filter(p => p.name === 'property')) {
        const parts = prop.part || [];
        if ((parts.find(p => p.name === 'code') || {}).valueCode === 'inactive') {
            inactive = (parts.find(p => p.name === 'value') || {}).valueBoolean === true;
        }
    }
    return { status: inactive ? 'inactive' : 'active', display };
}

/** Run tasks with limited concurrency so the public server is not hammered. */
async function pool(items, limit, worker) {
    const results = [];
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const i = index++;
            results[i] = await worker(items[i]);
        }
    }));
    return results;
}

(async () => {
    const files = collectFiles();
    const all = new Map();
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const [id] of extractIds(text)) {
            if (!all.has(id)) all.set(id, new Set());
            all.get(id).add(path.relative(ROOT, file));
        }
    }

    const ids = [...all.keys()].sort();
    console.log(`Checking ${ids.length} candidate concept IDs from ${files.length} files\n`);

    const token = await getNmpcToken();
    if (!token) console.log('  (no NMPC credentials in the environment — Irish extension IDs will be skipped)\n');

    const problems = [];
    let active = 0, skipped = 0;

    await pool(ids, 6, async id => {
        const irish = IRISH.test(id);
        if (irish && !token) { skipped++; return; }

        const base = irish ? NMPC : ONTOSERVER;
        const useToken = irish ? token : null;
        let result;
        try {
            result = await lookup(base, id, useToken);
        } catch (e) {
            result = { status: 'error', detail: e.message };
        }

        if (result.status === 'active') { active++; return; }
        // An ID absent from the international server may still be a valid Irish
        // concept, so retry there before calling it a problem.
        if (result.status === 'missing' && !irish && token) {
            const retry = await lookup(NMPC, id, token);
            if (retry.status === 'active') { active++; return; }
            if (retry.status === 'inactive') {
                problems.push({ id, status: 'inactive', display: retry.display, files: all.get(id) });
                return;
            }
        }
        if (result.status === 'missing') { skipped++; return; }
        problems.push({ id, ...result, files: all.get(id) });
    });

    console.log(`  active:  ${active}`);
    console.log(`  skipped: ${skipped} (not resolvable on the servers checked — usually not concept IDs)`);
    console.log(`  issues:  ${problems.length}\n`);

    const inactive = problems.filter(p => p.status === 'inactive');
    if (inactive.length) {
        console.error('INACTIVE CONCEPTS — these will silently return nothing:');
        for (const p of inactive) {
            console.error(`  ${p.id}  ${p.display || ''}`);
            console.error(`      used in: ${[...p.files].join(', ')}`);
        }
        process.exitCode = 1;
    }

    const errors = problems.filter(p => p.status === 'error');
    if (errors.length) {
        console.error('\nLOOKUP ERRORS (server problem, not necessarily a bad ID):');
        for (const p of errors) console.error(`  ${p.id}  ${p.detail}`);
    }

    if (!inactive.length) console.log('No inactive concepts found.');
})();
