#!/usr/bin/env node
/**
 * Static integrity checks for the site.
 *
 * Catches the class of bug that shipped a manifest pointing at icons which were
 * never committed: every local path referenced anywhere must resolve to a file
 * that exists.
 *
 *   node tools/check-assets.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const notes = [];

const fail = message => problems.push(message);

function htmlFiles() {
    return fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
}

function exists(relative) {
    const clean = relative.split('#')[0].split('?')[0];
    if (!clean || clean.startsWith('http') || clean.startsWith('mailto:') || clean.startsWith('data:')) return true;
    return fs.existsSync(path.join(ROOT, decodeURIComponent(clean)));
}

/* ---------- local references in HTML ---------- */

for (const file of htmlFiles()) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');

    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
    for (const ref of refs) {
        if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
        if (!exists(ref)) fail(`${file}: references missing file "${ref}"`);
    }

    // Duplicate element ids break getElementById in ways that are hard to spot.
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const seen = new Set(), dupes = new Set();
    for (const id of ids) { if (seen.has(id)) dupes.add(id); seen.add(id); }
    if (dupes.size) fail(`${file}: duplicate element id(s): ${[...dupes].join(', ')}`);

    // Every page must carry the shared regions, or nav/footer will drift.
    for (const region of ['head', 'nav', 'footer', 'overlays']) {
        if (!html.includes(`<!-- @partial ${region} -->`)) {
            fail(`${file}: missing shared region "${region}"`);
        }
    }

    // Structured data must parse.
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try { JSON.parse(json); }
        catch (e) { fail(`${file}: invalid JSON-LD (${e.message})`); }
    }

    if (!/<html lang="[a-z-]+"/.test(html)) fail(`${file}: <html> is missing a lang attribute`);
    if (!/<meta name="viewport"/.test(html)) fail(`${file}: missing viewport meta tag`);
    if (!/<title>/.test(html)) fail(`${file}: missing <title>`);

    const openBody = (html.match(/<body[\s>]/g) || []).length;
    const closeBody = (html.match(/<\/body>/g) || []).length;
    if (openBody !== 1 || closeBody !== 1) fail(`${file}: expected exactly one <body> pair`);
}

/* ---------- icon sprite ---------- */

const spritePath = path.join(ROOT, 'icons.svg');
if (!fs.existsSync(spritePath)) {
    fail('icons.svg is missing but the pages reference it');
} else {
    const sprite = fs.readFileSync(spritePath, 'utf8');
    const defined = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));

    // Every symbol referenced from markup or JS must exist, or it renders as
    // nothing at all — the failure mode is invisible, so it has to be caught here.
    const referenced = new Map();
    const scan = (text, where) => {
        for (const [, id] of text.matchAll(/icons\.svg#(i-[a-z0-9-]+)/g)) {
            if (!referenced.has(id)) referenced.set(id, new Set());
            referenced.get(id).add(where);
        }
    };
    for (const file of htmlFiles()) scan(fs.readFileSync(path.join(ROOT, file), 'utf8'), file);
    for (const file of fs.readdirSync(path.join(ROOT, 'js'))) {
        if (file.endsWith('.js')) scan(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8'), `js/${file}`);
    }

    for (const [id, where] of referenced) {
        if (!defined.has(id)) fail(`icons.svg has no symbol "${id}" (used in ${[...where].join(', ')})`);
    }

    // Icon names that live in data (icon: 'fa-x') are resolved at runtime, so a
    // missing symbol would only show up as a blank space in the UI.
    for (const file of fs.readdirSync(path.join(ROOT, 'js'))) {
        if (!file.endsWith('.js')) continue;
        const text = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
        for (const [, name] of text.matchAll(/icon:\s*'fa-([a-z0-9-]+)'/g)) {
            if (!defined.has(`i-${name}`)) {
                fail(`icons.svg has no symbol "i-${name}" (named in js/${file} data) — run tools/make-icon-sprite.js`);
            }
        }
        for (const [, name] of text.matchAll(/icon\(\s*'([a-z0-9-]+)'/g)) {
            if (!defined.has(`i-${name}`)) {
                fail(`icons.svg has no symbol "i-${name}" (icon('${name}') in js/${file})`);
            }
        }
    }

    // Dynamic names are built at runtime, so a symbol with no static reference
    // is normal; only report it as a note.
    notes.push(`icon sprite: ${defined.size} symbols, ${referenced.size} referenced statically`);

    // No page should still be loading the icon font.
    for (const file of htmlFiles()) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        if (/font-awesome|fontawesome/i.test(html)) fail(`${file}: still loads Font Awesome from a CDN`);
        if (/fonts\.googleapis\.com/.test(html)) fail(`${file}: still loads fonts from Google`);
        if (/<i class="fa/.test(html)) fail(`${file}: still contains a Font Awesome <i> tag`);
    }
}

/* ---------- fonts ---------- */

for (const font of ['fonts/inter-latin.woff2', 'fonts/jetbrains-mono-latin.woff2']) {
    if (!exists(font)) fail(`${font} is missing but styles.css declares it`);
}

/* ---------- manifest ---------- */

const manifestPath = path.join(ROOT, 'manifest.json');
if (!fs.existsSync(manifestPath)) fail('manifest.json is missing');
else {
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
        fail(`manifest.json does not parse: ${e.message}`);
    }
    if (manifest) {
        for (const icon of manifest.icons || []) {
            if (!exists(icon.src)) fail(`manifest.json: icon "${icon.src}" does not exist`);
        }
        for (const shortcut of manifest.shortcuts || []) {
            if (!exists(shortcut.url)) fail(`manifest.json: shortcut url "${shortcut.url}" does not exist`);
            for (const icon of shortcut.icons || []) {
                if (!exists(icon.src)) fail(`manifest.json: shortcut icon "${icon.src}" does not exist`);
            }
        }
        const png = (manifest.icons || []).filter(i => i.type === 'image/png');
        if (!png.some(i => i.sizes === '192x192')) fail('manifest.json: no 192x192 PNG icon (required for installability)');
        if (!png.some(i => i.sizes === '512x512')) fail('manifest.json: no 512x512 PNG icon (required for installability)');
    }
}

/* ---------- service worker ---------- */

const swPath = path.join(ROOT, 'sw.js');
if (!fs.existsSync(swPath)) fail('sw.js is missing but the site claims offline support');
else {
    const sw = fs.readFileSync(swPath, 'utf8');
    const listed = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
    for (const asset of listed) {
        if (!exists(asset)) fail(`sw.js: precaches missing file "${asset}"`);
    }
    // Every module the pages load should be precached, or offline breaks.
    const modules = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
    for (const module of modules) {
        if (!sw.includes(`js/${module}`)) fail(`sw.js: does not precache js/${module}`);
    }
}

/* ---------- sitemap ---------- */

const sitemapPath = path.join(ROOT, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
    const sitemap = fs.readFileSync(sitemapPath, 'utf8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    for (const loc of locs) {
        const file = loc.replace(/^https:\/\/snbyrnes\.github\.io\/ABC-of-ECL\//, '');
        if (file && !exists(file)) fail(`sitemap.xml: lists "${loc}" but ${file} does not exist`);
    }

    // A canonical that is not in the sitemap, or a sitemap entry that fights a
    // canonical, wastes the crawl budget.
    for (const file of htmlFiles()) {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
        if (!canonical) continue;
        const url = `https://snbyrnes.github.io/ABC-of-ECL/${file}`;
        if (locs.includes(url) && canonical !== url) {
            fail(`sitemap.xml lists ${url} but ${file} declares canonical ${canonical}`);
        }
    }
    notes.push(`sitemap lists ${locs.length} URLs`);
}

/* ---------- report ---------- */

if (notes.length) notes.forEach(n => console.log(`  note: ${n}`));

if (problems.length) {
    console.error(`\ncheck-assets: ${problems.length} problem(s)\n`);
    problems.forEach(p => console.error(`  ${p}`));
    process.exit(1);
}

console.log(`check-assets: all local references resolve across ${htmlFiles().length} pages`);
