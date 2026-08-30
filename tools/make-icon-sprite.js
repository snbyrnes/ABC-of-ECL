#!/usr/bin/env node
/**
 * Build a local SVG sprite containing only the icons this site uses.
 *
 * The site was loading the complete Font Awesome stylesheet from a CDN for
 * around eighty icons. That is a third-party, render-blocking request, and a
 * locked-down hospital network — which is exactly where the primary audience
 * sits — may simply refuse it, leaving the page with no icons and no fallback.
 *
 * This scans the source for icon names, fetches those glyphs once, and writes
 * icons.svg. One same-origin request, cached across every page and precached by
 * the service worker: 12 kB gzipped against Font Awesome's 100 kB of CSS plus
 * its webfonts. Re-run after adding an icon; CI fails if the sprite is stale.
 *
 *   node tools/make-icon-sprite.js
 *
 * Icons are Font Awesome Free, CC BY 4.0 (https://fontawesome.com/license/free).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'icons.svg');
const FA_VERSION = '6.5.1';
const BASE = `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${FA_VERSION}/svgs`;

/** Files that may reference an icon. */
function sourceFiles() {
    const files = fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.html'))
        .map(f => path.join(ROOT, f));
    for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
        if (f.endsWith('.js')) files.push(path.join(ROOT, 'js', f));
    }
    for (const f of fs.readdirSync(path.join(ROOT, 'partials'))) {
        if (f.endsWith('.html')) files.push(path.join(ROOT, 'partials', f));
    }
    return files;
}

/**
 * Collect every icon name the site can render.
 *
 * Icons are referenced three ways, and all three must be scanned or a symbol
 * goes missing and renders as nothing at all:
 *   1. markup / template strings  -> icons.svg#i-NAME
 *   2. helper calls               -> icon('NAME'), setIcon(el, 'NAME')
 *   3. data                       -> icon: 'fa-NAME' in templates.js, anatomy.js
 */
function collectIcons() {
    const names = new Set();
    for (const file of sourceFiles()) {
        const text = fs.readFileSync(file, 'utf8');
        for (const [, name] of text.matchAll(/icons\.svg#i-([a-z0-9-]+)/g)) names.add(name);
        for (const [, name] of text.matchAll(/icon\(\s*'([a-z0-9-]+)'/g)) names.add(name);
        for (const [, name] of text.matchAll(/setIcon\([^,]+,\s*'([a-z0-9-]+)'/g)) names.add(name);
        // Ternaries inside icon()/setIcon(): icon(cond ? 'a' : 'b')
        for (const [, a, b] of text.matchAll(/(?:set)?[Ii]con\([^)]*\?\s*'([a-z0-9-]+)'\s*:\s*'([a-z0-9-]+)'/g)) {
            names.add(a); names.add(b);
        }
        for (const [, name] of text.matchAll(/icon:\s*'fa-([a-z0-9-]+)'/g)) names.add(name);
    }
    names.delete('spin');
    return names;
}

async function fetchIcon(name) {
    // Nearly everything is a solid glyph; brand marks live in a separate set.
    let response = await fetch(`${BASE}/solid/${name}.svg`);
    if (!response.ok) response = await fetch(`${BASE}/brands/${name}.svg`);
    if (!response.ok) throw new Error(`${name}: not found in solid or brands (HTTP ${response.status})`);
    const svg = await response.text();

    const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1];
    if (!viewBox) throw new Error(`${name}: no viewBox`);

    // Font Awesome glyphs are a single path; keep the whole inner markup anyway
    // so a multi-part glyph would still work.
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
    if (!inner) throw new Error(`${name}: empty`);

    // Strip any hard-coded fill so the icon inherits currentColor.
    return { name, viewBox, inner: inner.replace(/\s*fill="(?!none)[^"]*"/g, '') };
}

async function pool(items, limit, worker) {
    const out = [];
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) {
            const index = i++;
            out[index] = await worker(items[index]);
        }
    }));
    return out;
}

(async () => {
    const names = [...collectIcons()].sort();
    console.log(`Collecting ${names.length} icons used across the site`);

    const failures = [];
    const glyphs = await pool(names, 8, async name => {
        try {
            return await fetchIcon(name);
        } catch (e) {
            failures.push(e.message);
            return null;
        }
    });

    const good = glyphs.filter(Boolean);
    if (failures.length) {
        console.error(`\n${failures.length} icon(s) could not be fetched:`);
        failures.forEach(f => console.error('  ' + f));
        // A missing glyph would render as an empty box, so refuse to write a
        // partial sprite over a working one.
        process.exit(1);
    }

    const body = good.map(g =>
        `    <symbol id="i-${g.name}" viewBox="${g.viewBox}">${g.inner}</symbol>`
    ).join('\n');

    const out = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Icon sprite. Generated by tools/make-icon-sprite.js - do not edit by hand.
  Icons: Font Awesome Free ${FA_VERSION}, CC BY 4.0
  https://fontawesome.com/license/free
-->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${body}
</svg>
`;
    fs.writeFileSync(OUT, out);
    const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
    console.log(`Wrote icons.svg - ${good.length} symbols, ${kb} kB`);
})();
