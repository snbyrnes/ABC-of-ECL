/**
 * Query Builder page.
 *
 * Design note: the builder never presents an empty state. On a cold visit it
 * selects a template, generates ECL and runs it, so the first thing a visitor
 * sees is a working query with real results rather than five placeholders.
 */

import { initShell, showToast, escapeHtml, icon, activeServer, onServerChange, openServerPanel, isConnected } from './shell.js';
import { templatesForModel, getTemplate, fieldsFor } from './templates.js';
import { expandEcl, searchConcepts, fetchEditionVersion, DEFAULT_PAGE_SIZE } from './fhir.js';
import { explain, buildConceptIndex } from './anatomy.js';
import { valueSetJson, valueSetFilename, downloadJson } from './valueset.js';
import { enhanceEclEditor } from './playground.js';

const HISTORY_KEY = 'ecl.history';
const HISTORY_LIMIT = 10;

/**
 * Legacy ?example= ids from the previous site, kept so old links keep working.
 * Ids whose template no longer exists are dropped; applyUrlState falls through
 * to the default template rather than failing.
 */
const LEGACY_EXAMPLES = {
    paracetamol: { template: 'products-by-ingredient', params: { ingredient: '387517004', ingredientTerm: 'Paracetamol' } },
    amoxicillin: { template: 'products-by-ingredient', params: { ingredient: '372687004', ingredientTerm: 'Amoxicillin' } },
    injectable:  { template: 'products-by-dose-form',  params: { doseForm: '385219001', doseFormTerm: 'Solution for injection' } }
};

const state = {
    templateId: null,
    params: {},
    ecl: '',
    results: [],
    total: 0,
    offset: 0,
    conceptIndex: null,
    running: false,
    editionVersion: null
};

const el = {};

function cacheElements() {
    [
        'templateList', 'queryDescription', 'builderForm', 'eclOutput', 'anatomyContent',
        'resultsContainer', 'resultCount', 'executeQuery', 'clearQuery', 'copyEcl',
        'copyLink', 'loadMore', 'resultActions', 'queryHistory', 'historyPanel',
        'serverNotice'
    ].forEach(id => { el[id] = document.getElementById(id); });
    el.anatomyPanel = document.querySelector('.anatomy-panel');
}

/* ---------- sidebar ---------- */

function renderSidebar() {
    const model = activeServer().model;
    el.templateList.innerHTML = templatesForModel(model).map(group => `
        <div class="template-category">
            <h4>${icon(group.icon.replace(/^fa-/, ''))} ${escapeHtml(group.label)}</h4>
            <div class="template-list" role="group" aria-label="${escapeHtml(group.label)} templates">
                ${group.items.map(t => `
                    <button class="template-btn" data-template="${escapeHtml(t.id)}" type="button">
                        <span class="template-name">${escapeHtml(t.name)}</span>
                        <span class="template-desc">${escapeHtml(t.desc)}</span>
                    </button>`).join('')}
            </div>
        </div>`).join('');

    el.templateList.querySelectorAll('.template-btn').forEach(button => {
        button.addEventListener('click', () => selectTemplate(button.dataset.template, {}, { run: true }));
    });
    markActiveTemplate();
}

function markActiveTemplate() {
    el.templateList.querySelectorAll('.template-btn').forEach(b => {
        const on = b.dataset.template === state.templateId;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
    });
}

/* ---------- template selection ---------- */

function defaultParamsFor(template, model) {
    const params = {};
    for (const field of fieldsFor(template, model)) {
        if (field.type === 'concept-search') {
            params[field.id] = field.default;
            params[`${field.id}Term`] = field.defaultTerm;
        } else if (field.type === 'select') {
            params[field.id] = field.default !== undefined ? field.default : field.options[0].value;
        } else if (field.type === 'checkbox') {
            params[field.id] = !!field.default;
        } else {
            params[field.id] = field.default !== undefined ? field.default : '';
        }
    }
    return params;
}

function selectTemplate(templateId, overrides = {}, { run = false } = {}) {
    const model = activeServer().model;
    const template = getTemplate(templateId);
    if (!template) return false;
    // A template can be unavailable on the current server's model.
    if (template.models && !template.models.includes(model.id)) return false;

    state.templateId = templateId;
    state.params = { ...defaultParamsFor(template, model), ...overrides };

    markActiveTemplate();
    buildForm(template, model);
    generateEcl();
    if (run) {
        if (isConnected()) executeQuery({ reset: true });
        else renderDisconnected();
    }
    return true;
}

/* ---------- form ---------- */

function buildForm(template, model) {
    const fields = fieldsFor(template, model);
    if (!fields.length) {
        el.builderForm.innerHTML = `<div class="form-placeholder"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-circle-check"/></svg>
            <p>This template needs no parameters. Run it as it stands.</p></div>`;
        return;
    }

    el.builderForm.innerHTML = fields.map(field => {
        const value = state.params[field.id];
        const label = `<label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}
            <span class="label-hint">${escapeHtml(field.hint || '')}</span></label>`;

        if (field.type === 'concept-search') {
            return `<div class="form-group">${label}
                <div class="concept-search">
                    <input type="text" id="${escapeHtml(field.id)}" class="form-control concept-search-input"
                           role="combobox" aria-expanded="false" aria-autocomplete="list"
                           aria-controls="${escapeHtml(field.id)}-suggestions"
                           data-ecl="${escapeHtml(field.ecl)}" data-field-id="${escapeHtml(field.id)}"
                           value="${escapeHtml(state.params[`${field.id}Term`] || '')}"
                           placeholder="Type at least 3 characters to search" autocomplete="off" spellcheck="false">
                    <span class="concept-search-code" data-code-for="${escapeHtml(field.id)}">${escapeHtml(value || '')}</span>
                    <ul class="concept-suggestions" id="${escapeHtml(field.id)}-suggestions" role="listbox"
                        aria-label="${escapeHtml(field.label)} suggestions"></ul>
                </div></div>`;
        }
        if (field.type === 'select') {
            return `<div class="form-group">${label}
                <select id="${escapeHtml(field.id)}" class="form-control" data-field-id="${escapeHtml(field.id)}">
                    ${field.options.map(o => `<option value="${escapeHtml(o.value)}" ${o.value === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
                </select></div>`;
        }
        if (field.type === 'checkbox') {
            return `<div class="form-group form-group-check">
                <label class="check-label" for="${escapeHtml(field.id)}">
                    <input type="checkbox" id="${escapeHtml(field.id)}" data-field-id="${escapeHtml(field.id)}" ${value ? 'checked' : ''}>
                    <span><strong>${escapeHtml(field.label)}</strong>
                    <span class="label-hint">${escapeHtml(field.hint || '')}</span></span>
                </label></div>`;
        }
        if (field.type === 'textarea') {
            return `<div class="form-group">${label}
                <textarea id="${escapeHtml(field.id)}" class="form-control ecl-textarea" rows="6"
                          data-field-id="${escapeHtml(field.id)}" spellcheck="false">${escapeHtml(value || '')}</textarea></div>`;
        }
        return `<div class="form-group">${label}
            <input type="${field.type === 'number' ? 'number' : 'text'}" id="${escapeHtml(field.id)}"
                   class="form-control" data-field-id="${escapeHtml(field.id)}" value="${escapeHtml(value || '')}"></div>`;
    }).join('');

    attachFormListeners();
}

function attachFormListeners() {
    el.builderForm.querySelectorAll('select.form-control').forEach(input => {
        input.addEventListener('change', e => {
            state.params[e.target.dataset.fieldId] = e.target.value;
            generateEcl();
        });
    });
    el.builderForm.querySelectorAll('input[type="checkbox"][data-field-id]').forEach(input => {
        input.addEventListener('change', e => {
            state.params[e.target.dataset.fieldId] = e.target.checked;
            generateEcl();
        });
    });
    el.builderForm.querySelectorAll('input.form-control:not(.concept-search-input), textarea.form-control').forEach(input => {
        input.addEventListener('input', e => {
            state.params[e.target.dataset.fieldId] = e.target.value;
            generateEcl();
        });
    });
    el.builderForm.querySelectorAll('.concept-search-input').forEach(initCombobox);

    // The free-text ECL box becomes a small editor: highlighting, advisory
    // validation and attribute autocomplete.
    const editor = el.builderForm.querySelector('textarea.ecl-textarea');
    if (editor) {
        teardownEditor?.();
        teardownEditor = enhanceEclEditor(editor, {
            model: activeServer().model,
            onInput: value => {
                state.params[editor.dataset.fieldId] = value;
                generateEcl();
            }
        });
    }
}

/** Cleanup for the editor attached to the previous template's form. */
let teardownEditor = null;

/* ---------- concept search combobox ---------- */

/** Per-field controllers so two pickers cannot cancel each other. */
const pickers = new Map();

function initCombobox(input) {
    const fieldId = input.dataset.fieldId;
    const list = document.getElementById(`${fieldId}-suggestions`);
    const controller = { timer: null, abort: null, items: [], index: -1 };
    pickers.set(fieldId, controller);

    const close = () => {
        list.classList.remove('active');
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        controller.index = -1;
    };

    const highlight = next => {
        const options = [...list.querySelectorAll('[role="option"]')];
        if (!options.length) return;
        controller.index = (next + options.length) % options.length;
        options.forEach((o, i) => o.classList.toggle('is-active', i === controller.index));
        const active = options[controller.index];
        active.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', active.id);
    };

    const choose = option => {
        input.value = option.dataset.display;
        state.params[fieldId] = option.dataset.code;
        state.params[`${fieldId}Term`] = option.dataset.display;
        const badge = el.builderForm.querySelector(`[data-code-for="${fieldId}"]`);
        if (badge) badge.textContent = option.dataset.code;
        close();
        generateEcl();
    };

    input.addEventListener('input', () => {
        const term = input.value.trim();
        clearTimeout(controller.timer);
        controller.abort?.abort();

        if (term.length < 3) { close(); list.innerHTML = ''; return; }

        list.innerHTML = '<li class="suggestion-note"><svg class="icon icon-spin" aria-hidden="true"><use href="icons.svg#i-spinner"/></svg> Searching…</li>';
        list.classList.add('active');
        input.setAttribute('aria-expanded', 'true');

        controller.timer = setTimeout(async () => {
            const abort = new AbortController();
            controller.abort = abort;
            try {
                const concepts = await searchConcepts(activeServer(), term, input.dataset.ecl, { signal: abort.signal });
                if (abort.signal.aborted) return;
                if (!concepts.length) {
                    list.innerHTML = '<li class="suggestion-note">No matching concepts</li>';
                    return;
                }
                list.innerHTML = concepts.map((c, i) => `
                    <li class="suggestion-item" role="option" id="${escapeHtml(fieldId)}-opt-${i}"
                        data-code="${escapeHtml(c.code)}" data-display="${escapeHtml(c.display)}">
                        <span class="concept-id">${escapeHtml(c.code)}</span>
                        <span class="concept-term">${escapeHtml(c.display)}</span>
                    </li>`).join('');
                list.querySelectorAll('[role="option"]').forEach(option => {
                    // mousedown fires before blur, so the click is never lost.
                    option.addEventListener('mousedown', e => { e.preventDefault(); choose(option); });
                });
            } catch (err) {
                if (err.name === 'AbortError') return;
                list.innerHTML = `<li class="suggestion-note suggestion-error">${escapeHtml(err.message)}</li>`;
            }
        }, 300);
    });

    input.addEventListener('keydown', e => {
        const open = list.classList.contains('active');
        if (e.key === 'ArrowDown') { e.preventDefault(); if (open) highlight(controller.index + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (open) highlight(controller.index - 1); }
        else if (e.key === 'Enter') {
            const active = list.querySelector('[role="option"].is-active');
            if (open && active) { e.preventDefault(); choose(active); }
        } else if (e.key === 'Escape') { if (open) { e.preventDefault(); close(); } }
        else if (e.key === 'Tab') { close(); }
    });

    input.addEventListener('blur', () => setTimeout(close, 0));
    input.addEventListener('focus', () => {
        if (list.children.length && input.value.trim().length >= 3) {
            list.classList.add('active');
            input.setAttribute('aria-expanded', 'true');
        }
    });
}

/* ---------- ECL generation ---------- */

function generateEcl() {
    const model = activeServer().model;
    const template = getTemplate(state.templateId);
    if (!template) { state.ecl = ''; el.eclOutput.textContent = '// Select a template'; return; }

    state.ecl = template.build(model, state.params);
    el.eclOutput.textContent = state.ecl;
    el.queryDescription.innerHTML = `<p>${template.describe(model, state.params)}</p>`;
    updateAnatomy();
    updatePermalink();
}

function updateAnatomy() {
    if (!state.conceptIndex) state.conceptIndex = buildConceptIndex(activeServer().model);
    const parts = explain(state.ecl, state.conceptIndex);
    if (!parts.length) {
        el.anatomyContent.innerHTML = `<div class="anatomy-placeholder"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-lightbulb"/></svg>
            <p>The breakdown appears once there is an expression to explain.</p></div>`;
        return;
    }
    el.anatomyContent.innerHTML = `<div class="anatomy-breakdown">${parts.map(p => `
        <div class="anatomy-item ${escapeHtml(p.kind)}">
            <div class="anatomy-icon">${icon(p.icon.replace(/^fa-/, ''))}</div>
            <div class="anatomy-details">
                <div class="anatomy-label">${escapeHtml(p.label)}</div>
                <div class="anatomy-code">${escapeHtml(p.code)}</div>
                <div class="anatomy-explanation">${escapeHtml(p.explanation)}</div>
                ${p.tip ? `<div class="anatomy-tip"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-lightbulb"/></svg> ${escapeHtml(p.tip)}</div>` : ''}
                ${p.warning ? `<div class="anatomy-warning"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-triangle-exclamation"/></svg> ${escapeHtml(p.warning)}</div>` : ''}
            </div>
        </div>`).join('')}</div>`;
}

/* ---------- permalink ---------- */

function permalinkFor(ecl) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('ecl', ecl);
    return url.toString();
}

function updatePermalink() {
    if (el.copyLink) el.copyLink.disabled = !state.ecl;
}

/* ---------- execution ---------- */

/** Results panel shown when there is no server connection yet. */
function renderDisconnected() {
    el.resultCount.textContent = '';
    el.resultActions.hidden = true;
    el.loadMore.hidden = true;
    el.resultsContainer.innerHTML = `
        <div class="results-placeholder results-connect">
            <svg class="icon" aria-hidden="true"><use href="icons.svg#i-plug-circle-exclamation"/></svg>
            <p>Connect to ${escapeHtml(activeServer().name)} to run this query.</p>
            <p class="results-hint">The expression above is already built — it just needs a server to run against.</p>
            <button type="button" class="btn btn-primary btn-small" id="connectPrompt">
                <svg class="icon" aria-hidden="true"><use href="icons.svg#i-right-to-bracket"/></svg> Sign in
            </button>
        </div>`;
    document.getElementById('connectPrompt')?.addEventListener('click', openServerPanel);
}

async function executeQuery({ reset = true } = {}) {
    if (!state.ecl.trim()) { showToast('There is no expression to run yet.', { error: true }); return; }
    if (state.running) return;
    if (!isConnected()) { renderDisconnected(); openServerPanel(); return; }

    state.running = true;
    const offset = reset ? 0 : state.offset + DEFAULT_PAGE_SIZE;
    setBusy(true, reset);

    try {
        const result = await expandEcl(activeServer(), state.ecl, { offset });
        state.offset = result.offset;
        state.total = result.total;
        state.results = reset ? result.concepts : state.results.concat(result.concepts);
        renderResults(result.hasMore);
        if (reset) rememberQuery(state.ecl);
        // Needed to pin the edition in an exported ValueSet; harmless if it fails.
        if (!state.editionVersion) {
            fetchEditionVersion(activeServer()).then(v => { state.editionVersion = v; });
        }
    } catch (err) {
        if (err.code === 'NO_CREDENTIALS') {
            renderError(err.message, { action: 'connect' });
        } else {
            renderError(err.message, { detail: err.detail });
        }
    } finally {
        state.running = false;
        setBusy(false, reset);
    }
}

function setBusy(busy, reset) {
    el.executeQuery.disabled = busy;
    el.executeQuery.innerHTML = busy && reset
        ? '<svg class="icon icon-spin" aria-hidden="true"><use href="icons.svg#i-spinner"/></svg> Running'
        : '<svg class="icon" aria-hidden="true"><use href="icons.svg#i-play"/></svg> Run query';
    if (el.loadMore) {
        el.loadMore.disabled = busy;
        el.loadMore.innerHTML = busy && !reset
            ? '<svg class="icon icon-spin" aria-hidden="true"><use href="icons.svg#i-spinner"/></svg> Loading'
            : '<svg class="icon" aria-hidden="true"><use href="icons.svg#i-plus"/></svg> Load more';
    }
    el.resultsContainer.setAttribute('aria-busy', String(busy));
}

/**
 * Irish extension concepts use the 1000220 namespace. Only the HSE server
 * carries them, and other servers answer with an empty set rather than an error.
 */
function usesIrishExtension(ecl) {
    return /\d+1000220\d{2}/.test(ecl);
}

function renderResults(hasMore) {
    const shown = state.results.length;
    el.resultCount.textContent = state.total
        ? `${state.total.toLocaleString()} concept${state.total === 1 ? '' : 's'}${shown < state.total ? ` · showing ${shown.toLocaleString()}` : ''}`
        : 'No concepts';

    if (!shown) {
        // An expression full of Irish extension concepts run against a server
        // that does not carry them returns zero rather than an error, which
        // reads as the user's own mistake. Say what actually happened.
        const wrongServer = usesIrishExtension(state.ecl) && activeServer().id !== 'nmpc-ie';
        el.resultsContainer.innerHTML = `<div class="results-placeholder"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-inbox"/></svg>
            <p>This query is valid but matched nothing.</p>
            ${wrongServer ? `
                <p class="results-hint">This expression uses Irish extension concepts, which
                   ${escapeHtml(activeServer().name)} does not carry — so it returns nothing rather
                   than an error.</p>
                <button type="button" class="btn btn-primary btn-small" id="switchServer">
                    <svg class="icon" aria-hidden="true"><use href="icons.svg#i-server"/></svg> Switch to HSE NMPC
                </button>`
              : `<p class="results-hint">Try a broader operator — <code>&lt;&lt;</code> instead of
                 <code>&lt;</code> — or check that the concept exists on this server.</p>`}
        </div>`;
        document.getElementById('switchServer')?.addEventListener('click', openServerPanel);
        el.resultActions.hidden = true;
        el.loadMore.hidden = true;
        return;
    }

    el.resultsContainer.innerHTML = `<ul class="results-list">${state.results.map(c => `
        <li class="result-item">
            <div class="result-content">
                <span class="result-code">${escapeHtml(c.code)}</span>
                <span class="result-term">${escapeHtml(c.display)}</span>
            </div>
            <div class="result-tools">
                <button type="button" class="result-tool" data-copy="${escapeHtml(c.code)}" title="Copy concept ID">
                    <svg class="icon" aria-hidden="true"><use href="icons.svg#i-copy"/></svg><span class="sr-only">Copy ${escapeHtml(c.code)}</span></button>
                <button type="button" class="result-tool" data-focus="${escapeHtml(c.code)}"
                        data-term="${escapeHtml(c.display)}" title="Use as the focus concept of a new query">
                    <svg class="icon" aria-hidden="true"><use href="icons.svg#i-crosshairs"/></svg><span class="sr-only">Explore ${escapeHtml(c.display)}</span></button>
                <a class="result-tool" href="https://browser.ihtsdotools.org/?perspective=full&conceptId1=${encodeURIComponent(c.code)}"
                   target="_blank" rel="noopener" title="Open in the SNOMED CT browser">
                    <svg class="icon" aria-hidden="true"><use href="icons.svg#i-arrow-up-right-from-square"/></svg><span class="sr-only">Open ${escapeHtml(c.code)} in SNOMED browser</span></a>
            </div>
        </li>`).join('')}</ul>`;

    el.resultActions.hidden = false;
    el.loadMore.hidden = !hasMore;

    el.resultsContainer.querySelectorAll('[data-copy]').forEach(b => {
        b.addEventListener('click', () => copy(b.dataset.copy, `Copied ${b.dataset.copy}`));
    });
    el.resultsContainer.querySelectorAll('[data-focus]').forEach(b => {
        b.addEventListener('click', () => {
            const ok = selectTemplate('descendants', {
                concept: b.dataset.focus, conceptTerm: b.dataset.term, includeSelf: true
            }, { run: true });
            if (ok) {
                showToast(`Exploring ${b.dataset.term}`);
                document.getElementById('builder-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function renderError(message, { detail = null, action = null } = {}) {
    el.resultCount.textContent = '';
    el.resultActions.hidden = true;
    el.loadMore.hidden = true;
    el.resultsContainer.innerHTML = `
        <div class="error-message">
            <svg class="icon" aria-hidden="true"><use href="icons.svg#i-triangle-exclamation"/></svg>
            <p class="error-headline">${escapeHtml(message)}</p>
            ${detail ? `<details class="error-detail"><summary>What the server said</summary><pre>${escapeHtml(detail)}</pre></details>` : ''}
            ${action === 'connect' ? '<button type="button" class="btn btn-primary btn-small" id="errorConnect"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-plug"/></svg> Choose a server</button>' : ''}
        </div>`;
    document.getElementById('errorConnect')?.addEventListener('click', openServerPanel);
}

/* ---------- clipboard, export, history ---------- */

function templateName() {
    const template = getTemplate(state.templateId);
    return template ? template.name : 'ECL query';
}

/**
 * Serialise the current query as a FHIR ValueSet.
 * The definition alone is the useful artefact; the expansion is included only
 * in the downloaded file, where the extra bulk costs nothing.
 */
function currentValueSetJson({ withExpansion }) {
    return valueSetJson(state.ecl, {
        name: templateName(),
        server: activeServer(),
        editionVersion: state.editionVersion,
        expansion: withExpansion ? state.results : null,
        total: state.total
    });
}

async function copy(text, message) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(message);
    } catch (e) {
        showToast('This browser blocked clipboard access.', { error: true });
    }
}

function toCsv(rows) {
    const escapeCell = v => `"${String(v).replace(/"/g, '""')}"`;
    return ['code,display', ...rows.map(r => [r.code, r.display].map(escapeCell).join(','))].join('\n');
}

function rememberQuery(ecl) {
    try {
        const list = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]')
            .filter(item => item !== ecl);
        list.unshift(ecl);
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
    } catch (e) { /* ignore */ }
    renderHistory();
}

function renderHistory() {
    if (!el.queryHistory) return;
    let list = [];
    try { list = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { /* ignore */ }
    el.historyPanel.hidden = list.length < 2;
    el.queryHistory.innerHTML = list.map((ecl, i) => `
        <li><button type="button" class="history-item" data-history="${i}">
            <code>${escapeHtml(ecl.replace(/\s+/g, ' ').slice(0, 90))}${ecl.length > 90 ? '…' : ''}</code>
        </button></li>`).join('');
    el.queryHistory.querySelectorAll('[data-history]').forEach(button => {
        button.addEventListener('click', () => {
            loadRawEcl(list[Number(button.dataset.history)]);
            executeQuery({ reset: true });
        });
    });
}

/* ---------- entry points ---------- */

function loadRawEcl(ecl) {
    selectTemplate('custom', { customEcl: ecl });
    const textarea = document.getElementById('customEcl');
    if (textarea) textarea.value = ecl;
    generateEcl();
}

/** Apply ?ecl= / ?template= / ?example= . Returns true when something loaded. */
function applyUrlState() {
    const params = new URLSearchParams(location.search);

    const ecl = params.get('ecl');
    if (ecl && ecl.trim()) { loadRawEcl(ecl); return true; }

    const templateId = params.get('template');
    if (templateId && selectTemplate(templateId)) return true;

    const example = params.get('example');
    if (example && LEGACY_EXAMPLES[example]) {
        const { template, params: p } = LEGACY_EXAMPLES[example];
        if (selectTemplate(template, p)) return true;
    }
    return false;
}

function initPanels() {
    // The anatomy panel is the reason this page is worth using, so it starts open.
    let collapsedPref = false;
    try { collapsedPref = localStorage.getItem('ecl.anatomyCollapsed') === 'true'; }
    catch (e) { /* storage unavailable */ }
    el.anatomyPanel?.classList.toggle('collapsed', collapsedPref);

    const toggle = document.getElementById('anatomyToggle');
    const header = el.anatomyPanel?.querySelector('.anatomy-header');
    const flip = () => {
        const collapsed = el.anatomyPanel.classList.toggle('collapsed');
        toggle?.setAttribute('aria-expanded', String(!collapsed));
        try { localStorage.setItem('ecl.anatomyCollapsed', String(collapsed)); } catch (e) { /* ignore */ }
    };
    toggle?.addEventListener('click', e => { e.stopPropagation(); flip(); });
    header?.addEventListener('click', e => { if (!toggle?.contains(e.target)) flip(); });
    toggle?.setAttribute('aria-expanded', String(!collapsedPref));
}

function initActions() {
    el.executeQuery.addEventListener('click', () => executeQuery({ reset: true }));
    el.loadMore?.addEventListener('click', () => executeQuery({ reset: false }));
    el.copyEcl.addEventListener('click', () => copy(state.ecl, 'ECL copied'));
    el.copyLink?.addEventListener('click', () => copy(permalinkFor(state.ecl), 'Shareable link copied'));

    document.getElementById('exportCsv')?.addEventListener('click', () => {
        copy(toCsv(state.results), `${state.results.length} rows copied as CSV`);
    });
    document.getElementById('exportJson')?.addEventListener('click', () => {
        copy(JSON.stringify(state.results.map(r => ({ code: r.code, display: r.display })), null, 2),
             `${state.results.length} rows copied as JSON`);
    });
    document.getElementById('copyValueSet')?.addEventListener('click', () => {
        copy(currentValueSetJson({ withExpansion: false }), 'FHIR ValueSet copied');
    });
    document.getElementById('downloadValueSet')?.addEventListener('click', () => {
        const name = templateName();
        downloadJson(valueSetFilename(name), currentValueSetJson({ withExpansion: true }));
        showToast('ValueSet downloaded');
    });

    el.clearQuery.addEventListener('click', () => {
        state.results = []; state.total = 0; state.offset = 0;
        el.resultsContainer.innerHTML = `<div class="results-placeholder"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-magnifying-glass"/></svg>
            <p>Run a query to see concepts here.</p></div>`;
        el.resultCount.textContent = '';
        el.resultActions.hidden = true;
        el.loadMore.hidden = true;
    });

    // Ctrl/Cmd+Enter runs the query from anywhere on the page.
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); executeQuery({ reset: true }); }
    });
}

function showServerNotice() {
    const server = activeServer();
    if (!el.serverNotice) return;
    el.serverNotice.innerHTML = `<svg class="icon" aria-hidden="true"><use href="icons.svg#i-server"/></svg>
        Querying <strong>${escapeHtml(server.name)}</strong> — ${escapeHtml(server.edition)}.
        <button type="button" class="link-button" id="changeServer">Change server</button>`;
    document.getElementById('changeServer')?.addEventListener('click', openServerPanel);
}

function start() {
    cacheElements();
    initShell();
    initPanels();
    initActions();
    renderSidebar();
    showServerNotice();
    renderHistory();

    // Never land on an empty builder: a template is always selected and its ECL
    // generated. It is only executed once there is a server to execute against.
    const connected = isConnected();
    const loadedFromUrl = applyUrlState();
    if (!loadedFromUrl) {
        const model = activeServer().model;
        const first = model.levels && model.levels.length ? 'prescribe-to-dispense' : 'products-by-ingredient';
        selectTemplate(first);
    }
    if (connected) executeQuery({ reset: true });
    else renderDisconnected();

    onServerChange(() => {
        state.conceptIndex = buildConceptIndex(activeServer().model);
        renderSidebar();
        showServerNotice();
        // The current template may not exist on the new model.
        if (!selectTemplate(state.templateId)) selectTemplate('products-by-ingredient');
        if (isConnected()) executeQuery({ reset: true });
        else renderDisconnected();
    });
}

document.addEventListener('DOMContentLoaded', start);
