#!/usr/bin/env node
/**
 * Check that outbound links still resolve.
 *
 * Run on a schedule rather than on every push: link rot is real but a third
 * party being briefly unreachable should not block a deploy. Exits 0 unless
 * --strict is passed.
 *
 *   node tools/check-links.js [--strict]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const strict = process.argv.includes('--strict');
const TIMEOUT = 15000;

/** Hosts that require auth or block bots; a 401/403/405 from these is expected. */
const AUTH_EXPECTED = ['nmpc.hse.ie', 'browser.ihtsdotools.org'];

/**
 * API endpoints linked for reference. A bare GET on a FHIR base is not a valid
 * request, so a 4xx here means the host is up, which is all we can check.
 */
const API_ENDPOINTS = ['r4.ontoserver.csiro.au/fhir'];

/**
 * Only anchors are checked. <link> elements are preconnect hints and canonical
 * URLs — a preconnect host has no page at its root, and the canonical of a page
 * that has not been deployed yet is expected to 404.
 */
const links = new Map();
for (const file of fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [, url] of html.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"/g)) {
        if (!links.has(url)) links.set(url, new Set());
        links.get(url).add(file);
    }
}

async function probe(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        // Some servers reject HEAD; fall back to a ranged GET.
        let response = await fetch(url, {
            method: 'HEAD', redirect: 'follow', signal: controller.signal,
            headers: { 'User-Agent': 'ABC-of-ECL link checker' }
        });
        if (!response.ok) {
            response = await fetch(url, {
                method: 'GET', redirect: 'follow', signal: controller.signal,
                headers: { 'User-Agent': 'ABC-of-ECL link checker' }
            });
        }
        return { ok: response.ok || response.status === 206, status: response.status };
    } catch (e) {
        return { ok: false, status: e.name === 'AbortError' ? 'timeout' : e.message };
    } finally {
        clearTimeout(timer);
    }
}

(async () => {
    const urls = [...links.keys()].sort();
    console.log(`Checking ${urls.length} outbound links\n`);

    const broken = [];
    let index = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
        while (index < urls.length) {
            const url = urls[index++];
            const result = await probe(url);
            const host = new URL(url).hostname;
            const expectedAuth = AUTH_EXPECTED.some(h => host.endsWith(h))
                && [401, 403, 405].includes(result.status);
            const isApi = API_ENDPOINTS.some(e => url.includes(e))
                && typeof result.status === 'number' && result.status < 500;
            if (result.ok || expectedAuth || isApi) {
                console.log(`  ok    ${String(result.status).padEnd(8)} ${url}`);
            } else {
                console.log(`  FAIL  ${String(result.status).padEnd(8)} ${url}`);
                broken.push({ url, status: result.status, files: links.get(url) });
            }
        }
    }));

    if (broken.length) {
        console.error(`\n${broken.length} link(s) did not resolve:`);
        for (const b of broken) {
            console.error(`  ${b.url}  [${b.status}]`);
            console.error(`      linked from: ${[...b.files].join(', ')}`);
        }
        if (strict) process.exit(1);
        console.error('\n(not failing the build — re-run to confirm before editing)');
    } else {
        console.log('\nAll outbound links resolve.');
    }
})();
