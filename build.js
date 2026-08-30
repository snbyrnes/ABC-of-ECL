#!/usr/bin/env node
/**
 * Sync shared markup from partials/ into the HTML pages.
 *
 * The pages stay plain, directly-openable HTML — there is no runtime templating
 * and no flash of unstyled navigation. Each page marks the regions it shares:
 *
 *     <!-- @partial nav -->  ...generated...  <!-- @endpartial -->
 *
 * Run `node build.js` after editing anything in partials/. Run
 * `node build.js --check` in CI to fail the build when a page is out of date.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PARTIALS = path.join(ROOT, 'partials');
const PAGES = ['index.html', 'builder.html', 'compare.html', 'examples.html', 'resources.html', '404.html'];

const check = process.argv.includes('--check');

function loadPartials() {
    const map = {};
    for (const file of fs.readdirSync(PARTIALS)) {
        if (!file.endsWith('.html')) continue;
        map[path.basename(file, '.html')] = fs.readFileSync(path.join(PARTIALS, file), 'utf8').trimEnd();
    }
    return map;
}

/** Indent a block to match the indentation of its opening marker. */
function indent(block, pad) {
    return block.split('\n').map(line => (line.trim() ? pad + line : line)).join('\n');
}

/** Mark the nav link for this page as current, so there is no first-paint flash. */
function markActive(block, page) {
    return block.replace(
        new RegExp(`(<li><a href="${page.replace('.', '\\.')}")`, 'g'),
        '$1 class="active" aria-current="page"'
    );
}

function render(page, source, partials) {
    const missing = [];
    const out = source.replace(
        /([ \t]*)<!-- @partial ([a-z0-9-]+) -->[\s\S]*?<!-- @endpartial -->/g,
        (match, pad, name) => {
            if (!(name in partials)) { missing.push(name); return match; }
            let block = partials[name];
            if (name === 'nav') block = markActive(block, page);
            return `${pad}<!-- @partial ${name} -->\n${indent(block, pad)}\n${pad}<!-- @endpartial -->`;
        }
    );
    if (missing.length) throw new Error(`${page} references unknown partial(s): ${missing.join(', ')}`);
    return out;
}

const partials = loadPartials();
let changed = 0;
let checkedRegions = 0;

for (const page of PAGES) {
    const file = path.join(ROOT, page);
    if (!fs.existsSync(file)) {
        console.error(`  missing page: ${page}`);
        process.exitCode = 1;
        continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    const regions = (source.match(/<!-- @partial /g) || []).length;
    checkedRegions += regions;
    if (!regions) {
        console.error(`  ${page}: no partial regions found — shared markup will drift`);
        process.exitCode = 1;
        continue;
    }
    const rendered = render(page, source, partials);
    if (rendered !== source) {
        changed++;
        if (check) {
            console.error(`  out of date: ${page}`);
            process.exitCode = 1;
        } else {
            fs.writeFileSync(file, rendered);
            console.log(`  updated: ${page}`);
        }
    }
}

if (check) {
    if (changed === 0) console.log(`build: all ${PAGES.length} pages current (${checkedRegions} shared regions)`);
    else console.error(`build: ${changed} page(s) out of date — run "node build.js" and commit the result`);
} else {
    console.log(changed ? `build: ${changed} page(s) rewritten` : `build: already current (${checkedRegions} shared regions)`);
}
