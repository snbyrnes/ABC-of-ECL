/**
 * Compare two expressions side by side.
 *
 * Reading that `<` excludes the concept itself is abstract. Seeing 3,730 next
 * to 3,731 and clicking the single concept in the difference is not. The set
 * arithmetic runs in the browser over two expansions.
 *
 * Expansions are capped (see FETCH_CAP). When a query exceeds the cap the
 * comparison is reported as partial rather than silently truncated, because a
 * wrong difference is worse than no difference.
 */

import { initShell, showToast, escapeHtml, activeServer, onServerChange, openServerPanel, isConnected } from './shell.js';
import { expandEcl } from './fhir.js';

const PAGE = 1000;
const FETCH_CAP = 10000;

const PRESETS = [
    {
        label: 'Descendants, with and without self',
        why: 'The classic. The difference is exactly one concept: the starting point itself.',
        a: '<< 763158003 |Medicinal product|',
        b: '< 763158003 |Medicinal product|'
    },
    {
        label: 'All descendants vs direct children',
        why: 'Shows how much of a hierarchy sits below the first level.',
        a: '< 763158003 |Medicinal product|',
        b: '<! 763158003 |Medicinal product|'
    },
    {
        label: 'Attribute with and without sub-attributes',
        why: '<< on an attribute also matches its sub-attributes, such as "Has precise active ingredient".',
        a: '< 763158003 |Medicinal product| : << 127489000 |Has active ingredient| = << 387517004 |Paracetamol|',
        b: '< 763158003 |Medicinal product| : 127489000 |Has active ingredient| = << 387517004 |Paracetamol|'
    },
    {
        label: 'Generic products vs branded products',
        why: 'VMP and AMP describe the same medicines at different levels. Nothing is in both — which is the point of the hierarchy.',
        a: '^ 660371000220109 |VMP reference set|',
        b: '^ 660381000220107 |AMP reference set|'
    },
    {
        label: 'Reference set vs hierarchy',
        why: 'Membership is curated, subtypes are inferred. The same medicine can be in one and not the other.',
        a: '^ 660371000220109 |VMP reference set|',
        b: '< 763158003 |Medicinal product| : 411116001 |Has manufactured dose form| = *'
    }
];

const state = { a: [], b: [], tab: 'onlyA', partial: false };
const el = {};

function cache() {
    ['eclA', 'eclB', 'runCompare', 'compareResults', 'countA', 'countB', 'countBoth',
     'presetList', 'compareSummary', 'compareTabs', 'swapQueries'].forEach(id => { el[id] = document.getElementById(id); });
}

/** Expand fully, up to the cap. Returns { concepts, complete }. */
async function expandAll(ecl, onProgress) {
    const seen = new Map();
    let offset = 0;
    let total = Infinity;

    while (offset < total && seen.size < FETCH_CAP) {
        const result = await expandEcl(activeServer(), ecl, { offset, count: PAGE });
        total = result.total;
        result.concepts.forEach(c => seen.set(c.code, c.display));
        if (!result.concepts.length) break;
        offset += result.concepts.length;
        onProgress?.(seen.size, total);
    }
    return { concepts: seen, complete: seen.size >= total };
}

function renderPresets() {
    el.presetList.innerHTML = PRESETS.map((p, i) => `
        <button type="button" class="preset-btn" data-preset="${i}">
            <span class="preset-label">${escapeHtml(p.label)}</span>
            <span class="preset-why">${escapeHtml(p.why)}</span>
        </button>`).join('');
    el.presetList.querySelectorAll('[data-preset]').forEach(button => {
        button.addEventListener('click', () => {
            const preset = PRESETS[Number(button.dataset.preset)];
            el.eclA.value = preset.a;
            el.eclB.value = preset.b;
            run();
        });
    });
}

async function run() {
    const a = el.eclA.value.trim();
    const b = el.eclB.value.trim();
    if (!a || !b) { showToast('Enter an expression in both boxes.', { error: true }); return; }
    if (!isConnected()) {
        el.compareSummary.innerHTML = `<div class="results-placeholder results-connect">
            <svg class="icon" aria-hidden="true"><use href="icons.svg#i-plug-circle-exclamation"/></svg>
            <p>Connect to ${escapeHtml(activeServer().name)} to compare these expressions.</p>
        </div>`;
        openServerPanel();
        return;
    }

    el.runCompare.disabled = true;
    el.runCompare.innerHTML = '<svg class="icon icon-spin" aria-hidden="true"><use href="icons.svg#i-spinner"/></svg> Comparing';
    el.compareSummary.innerHTML = '<p class="compare-progress">Expanding query A…</p>';
    el.compareResults.innerHTML = '';
    el.compareTabs.hidden = true;

    try {
        const resA = await expandAll(a, n => {
            el.compareSummary.innerHTML = `<p class="compare-progress">Expanding query A… ${n.toLocaleString()} concepts</p>`;
        });
        const resB = await expandAll(b, n => {
            el.compareSummary.innerHTML = `<p class="compare-progress">Expanding query B… ${n.toLocaleString()} concepts</p>`;
        });

        const onlyA = [], onlyB = [], both = [];
        for (const [code, display] of resA.concepts) {
            (resB.concepts.has(code) ? both : onlyA).push({ code, display });
        }
        for (const [code, display] of resB.concepts) {
            if (!resA.concepts.has(code)) onlyB.push({ code, display });
        }

        state.a = onlyA; state.b = onlyB; state.both = both;
        state.partial = !resA.complete || !resB.complete;

        el.countA.textContent = resA.concepts.size.toLocaleString();
        el.countB.textContent = resB.concepts.size.toLocaleString();
        el.countBoth.textContent = both.length.toLocaleString();

        el.compareSummary.innerHTML = renderSummary(onlyA.length, onlyB.length, both.length);
        el.compareTabs.hidden = false;
        setTab(onlyA.length ? 'onlyA' : onlyB.length ? 'onlyB' : 'both');
    } catch (err) {
        el.compareSummary.innerHTML = `<div class="error-message">
            <svg class="icon" aria-hidden="true"><use href="icons.svg#i-triangle-exclamation"/></svg>
            <p class="error-headline">${escapeHtml(err.message)}</p>
            ${err.detail ? `<details class="error-detail"><summary>What the server said</summary><pre>${escapeHtml(err.detail)}</pre></details>` : ''}
            ${err.code === 'NO_CREDENTIALS' ? '<button type="button" class="btn btn-primary btn-small" id="cmpConnect"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-plug"/></svg> Choose a server</button>' : ''}
        </div>`;
        document.getElementById('cmpConnect')?.addEventListener('click', openServerPanel);
    } finally {
        el.runCompare.disabled = false;
        el.runCompare.innerHTML = '<svg class="icon" aria-hidden="true"><use href="icons.svg#i-code-compare"/></svg> Compare';
    }
}

function renderSummary(onlyA, onlyB, both) {
    const cap = state.partial
        ? `<p class="compare-warning"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-triangle-exclamation"/></svg>
            One or both queries returned more than ${FETCH_CAP.toLocaleString()} concepts, so only the first
            ${FETCH_CAP.toLocaleString()} of each were compared. The differences below are incomplete.
            Narrow the queries for an exact answer.</p>` : '';
    let verdict;
    if (!onlyA && !onlyB) verdict = 'The two expressions select <strong>exactly the same concepts</strong>.';
    else if (!onlyA) verdict = `Query A is a <strong>subset</strong> of query B. B adds ${onlyB.toLocaleString()} concept${onlyB === 1 ? '' : 's'}.`;
    else if (!onlyB) verdict = `Query B is a <strong>subset</strong> of query A. A adds ${onlyA.toLocaleString()} concept${onlyA === 1 ? '' : 's'}.`;
    else verdict = `The two expressions overlap on ${both.toLocaleString()} concept${both === 1 ? '' : 's'}, and each selects concepts the other misses.`;
    return `${cap}<p class="compare-verdict">${verdict}</p>`;
}

function setTab(tab) {
    state.tab = tab;
    el.compareTabs.querySelectorAll('[data-tab]').forEach(b => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
    const rows = tab === 'onlyA' ? state.a : tab === 'onlyB' ? state.b : state.both;
    if (!rows.length) {
        el.compareResults.innerHTML = '<div class="results-placeholder"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-inbox"/></svg><p>Nothing in this set.</p></div>';
        return;
    }
    const shown = rows.slice(0, 500);
    el.compareResults.innerHTML = `
        ${rows.length > shown.length ? `<p class="compare-note">Showing the first ${shown.length} of ${rows.length.toLocaleString()}.</p>` : ''}
        <ul class="results-list">${shown.map(c => `
            <li class="result-item">
                <div class="result-content">
                    <span class="result-code">${escapeHtml(c.code)}</span>
                    <span class="result-term">${escapeHtml(c.display)}</span>
                </div>
                <div class="result-tools">
                    <a class="result-tool" href="https://browser.ihtsdotools.org/?perspective=full&conceptId1=${encodeURIComponent(c.code)}"
                       target="_blank" rel="noopener" title="Open in the SNOMED CT browser">
                        <svg class="icon" aria-hidden="true"><use href="icons.svg#i-arrow-up-right-from-square"/></svg><span class="sr-only">Open ${escapeHtml(c.code)}</span></a>
                </div>
            </li>`).join('')}</ul>`;
}

function start() {
    cache();
    initShell();
    renderPresets();

    const params = new URLSearchParams(location.search);
    if (params.get('a')) el.eclA.value = params.get('a');
    if (params.get('b')) el.eclB.value = params.get('b');
    if (!el.eclA.value) el.eclA.value = PRESETS[0].a;
    if (!el.eclB.value) el.eclB.value = PRESETS[0].b;

    el.runCompare.addEventListener('click', run);
    el.swapQueries.addEventListener('click', () => {
        const tmp = el.eclA.value; el.eclA.value = el.eclB.value; el.eclB.value = tmp;
    });
    el.compareTabs.querySelectorAll('[data-tab]').forEach(b => {
        b.addEventListener('click', () => setTab(b.dataset.tab));
    });
    onServerChange(() => showToast('Server changed. Run the comparison again.'));

    if (params.get('a') && params.get('b') && isConnected()) run();
}

document.addEventListener('DOMContentLoaded', start);
