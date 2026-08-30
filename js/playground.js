/**
 * ECL editor: syntax highlighting, live validation and attribute autocomplete.
 *
 * The highlighter reuses the anatomy tokeniser rather than growing a second
 * parser — the token stream it already produces, including an `unknown` type
 * for anything it cannot identify, is exactly what highlighting needs.
 *
 * Validation is advisory. The terminology server is the authority on whether an
 * expression is valid, so nothing here blocks a query from running; it only
 * points at things that are almost certainly mistakes.
 */

import { tokenise, OPERATORS } from './anatomy.js';
import { escapeHtml, icon } from './shell.js';

/* ---------- SNOMED identifier check digit ---------- */

const VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * SNOMED CT identifiers carry a Verhoeff check digit. Verifying it catches
 * every single-digit typo and every adjacent transposition before a request is
 * sent, which is the difference between "that ID is mistyped" and an empty
 * result set the reader blames on their own query.
 */
export function isValidSctId(id) {
    if (!/^\d{6,18}$/.test(id)) return false;
    let c = 0;
    const digits = String(id).split('').reverse().map(Number);
    for (let i = 0; i < digits.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
    return c === 0;
}

/* ---------- highlighting ---------- */

const TOKEN_CLASS = {
    operator: 'tok-op',
    concept: 'tok-concept',
    number: 'tok-number',
    string: 'tok-string',
    wildcard: 'tok-op',
    grouping: 'tok-group',
    unknown: 'tok-unknown'
};

export function highlight(ecl) {
    const source = String(ecl || '');
    const tokens = tokenise(source);
    let html = '';
    let cursor = 0;

    for (const token of tokens) {
        // Whitespace between tokens is preserved verbatim so the overlay lines
        // up with the textarea character for character.
        if (token.start > cursor) html += escapeHtml(source.slice(cursor, token.start));

        if (token.type === 'concept') {
            const idOk = isValidSctId(token.value);
            html += `<span class="tok-id${idOk ? '' : ' tok-bad-id'}">${escapeHtml(token.value)}</span>`;
            const rest = source.slice(token.start + token.value.length, token.end);
            if (rest) html += `<span class="tok-term">${escapeHtml(rest)}</span>`;
        } else {
            html += `<span class="${TOKEN_CLASS[token.type] || ''}">${escapeHtml(token.raw)}</span>`;
        }
        cursor = token.end;
    }
    if (cursor < source.length) html += escapeHtml(source.slice(cursor));

    // A trailing newline is collapsed by <pre>; a space keeps the last line visible.
    return html + '\n';
}

/* ---------- validation ---------- */

/**
 * Return advisory diagnostics: [{ severity, message }].
 * `error` means the server will almost certainly reject it; `warning` means it
 * will run but probably does not mean what was intended.
 */
export function validate(ecl) {
    const source = String(ecl || '').trim();
    const issues = [];
    if (!source) return issues;

    const tokens = tokenise(source);

    // Pipe balance — an unclosed term swallows the rest of the expression.
    const pipes = (source.match(/\|/g) || []).length;
    if (pipes % 2 !== 0) issues.push({ severity: 'error', message: 'A term is missing its closing | character.' });

    // Unrecognised input. Reported after the pipe check, because an unclosed
    // term is usually the reason the rest stopped parsing.
    const unknown = tokens.filter(t => t.type === 'unknown');
    if (unknown.length && pipes % 2 === 0) {
        const shown = [...new Set(unknown.map(t => t.raw))].slice(0, 3).join(', ');
        issues.push({ severity: 'error', message: `Not valid ECL: ${shown}` });
    }

    // Bracket balance.
    let depth = 0, unopened = false;
    for (const t of tokens) {
        if (t.type !== 'grouping') continue;
        depth += t.raw === '(' ? 1 : -1;
        if (depth < 0) { unopened = true; break; }
    }
    if (unopened) issues.push({ severity: 'error', message: 'A closing bracket has no matching opening bracket.' });
    else if (depth > 0) issues.push({ severity: 'error', message: `${depth} bracket${depth === 1 ? ' is' : 's are'} still open.` });

    // Concept identifiers.
    for (const t of tokens) {
        if (t.type !== 'concept' || isValidSctId(t.value)) continue;
        issues.push({
            severity: 'error',
            message: `${t.value} is not a valid SNOMED CT identifier — its check digit does not match, so it is probably mistyped.`
        });
    }

    // Structure: an expression should not end mid-thought.
    const last = tokens[tokens.length - 1];
    if (last && last.type === 'operator' && last.value !== '*') {
        issues.push({ severity: 'error', message: `The expression ends with "${last.raw}" and nothing after it.` });
    }

    // A refinement needs an attribute and a value.
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type !== 'operator') continue;
        if (t.value === ':' || t.value === ',') {
            const next = tokens[i + 1];
            if (!next) continue;   // already reported by the trailing-operator rule
            if (next.type !== 'concept' && !(next.type === 'operator' && ['<<', '<', '>>', '>', '^'].includes(next.value))) {
                issues.push({ severity: 'warning', message: `"${t.raw}" should be followed by an attribute.` });
            }
        }
        if (t.value === '=' || t.value === '!=') {
            if (!tokens[i + 1]) continue;
        }
    }

    // Refinement without any attribute at all.
    const colon = tokens.findIndex(t => t.type === 'operator' && t.value === ':');
    if (colon !== -1) {
        const after = tokens.slice(colon + 1);
        if (!after.some(t => t.type === 'operator' && (t.value === '=' || t.value === '!='))) {
            issues.push({ severity: 'warning', message: 'A refinement was opened with ":" but no attribute value is set.' });
        }
    }

    return issues;
}

/* ---------- autocomplete ---------- */

/** Suggestion list for the model: the things that are hard to remember. */
function suggestionsFor(model) {
    const items = [];
    for (const [, a] of Object.entries(model.attributes || {})) {
        items.push({ label: a.term, insert: `${a.id} |${a.term}|`, kind: 'attribute', detail: a.id });
    }
    for (const level of model.levels || []) {
        items.push({
            label: `${level.name} reference set`,
            insert: `^ ${level.refset} |${level.name} reference set|`,
            kind: 'refset', detail: level.label
        });
    }
    for (const r of model.namedRefsets || []) {
        items.push({ label: r.term, insert: `^ ${r.id} |${r.term}|`, kind: 'refset', detail: r.id });
    }
    for (const [symbol, info] of Object.entries(OPERATORS)) {
        if ([',', '='].includes(symbol)) continue;
        items.push({ label: symbol, insert: symbol + ' ', kind: 'operator', detail: info.name });
    }
    return items;
}

/** The partial word immediately before the caret. */
function wordBefore(text, caret) {
    const upto = text.slice(0, caret);
    const m = upto.match(/([A-Za-z][A-Za-z ]*)$/);
    return m ? m[1] : '';
}

/* ---------- editor ---------- */

/**
 * Upgrade a plain textarea into the ECL editor.
 * Returns a teardown function.
 */
export function enhanceEclEditor(textarea, { model, onInput }) {
    if (!textarea || textarea.dataset.enhanced === 'true') return () => {};
    textarea.dataset.enhanced = 'true';

    const wrap = document.createElement('div');
    wrap.className = 'ecl-editor';
    textarea.parentNode.insertBefore(wrap, textarea);

    const layer = document.createElement('pre');
    layer.className = 'ecl-editor-layer';
    layer.setAttribute('aria-hidden', 'true');
    const code = document.createElement('code');
    layer.appendChild(code);

    const list = document.createElement('ul');
    list.className = 'ecl-suggest';
    list.setAttribute('role', 'listbox');

    wrap.appendChild(layer);
    wrap.appendChild(textarea);
    wrap.appendChild(list);
    textarea.classList.add('ecl-editor-input');
    textarea.setAttribute('spellcheck', 'false');
    textarea.setAttribute('autocomplete', 'off');

    const diagnostics = document.createElement('div');
    diagnostics.className = 'ecl-diagnostics';
    diagnostics.setAttribute('role', 'status');
    wrap.insertAdjacentElement('afterend', diagnostics);

    // Autocomplete fires on its own after ":" or ",", but the manual shortcut
    // is not discoverable without saying so.
    const hint = document.createElement('p');
    hint.className = 'editor-hint';
    hint.innerHTML = 'Suggestions appear after <code>:</code> or <code>,</code>. '
        + 'Press <kbd>Ctrl</kbd>+<kbd>Space</kbd> for them anywhere.';
    diagnostics.insertAdjacentElement('afterend', hint);

    const items = suggestionsFor(model);
    let active = -1;
    let filtered = [];

    const paint = () => {
        code.innerHTML = highlight(textarea.value);
        layer.scrollTop = textarea.scrollTop;
        layer.scrollLeft = textarea.scrollLeft;
    };

    const report = () => {
        const issues = validate(textarea.value);
        if (!issues.length) {
            diagnostics.innerHTML = textarea.value.trim()
                ? '<p class="diag diag-ok"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-circle-check"/></svg> No problems found. The server has the final say.</p>'
                : '';
            return;
        }
        diagnostics.innerHTML = issues.map(i => `
            <p class="diag diag-${i.severity}">
                ${icon(i.severity === 'error' ? 'circle-xmark' : 'triangle-exclamation')}
                ${escapeHtml(i.message)}
            </p>`).join('');
    };

    const closeList = () => {
        list.classList.remove('active');
        list.innerHTML = '';
        active = -1;
        filtered = [];
    };

    const openList = () => {
        const caret = textarea.selectionStart;
        const before = textarea.value.slice(0, caret);
        const word = wordBefore(textarea.value, caret).trimStart();

        // Offer attributes right after a refinement marker, otherwise filter by
        // whatever word is being typed.
        const inAttributeSlot = /[:,]\s*$/.test(before);
        let matches;
        if (inAttributeSlot) {
            matches = items.filter(i => i.kind === 'attribute');
        } else if (word.length >= 2) {
            const needle = word.toLowerCase();
            matches = items.filter(i => i.label.toLowerCase().includes(needle));
        } else {
            closeList();
            return;
        }

        if (!matches.length) { closeList(); return; }
        filtered = matches.slice(0, 8);
        active = 0;
        list.innerHTML = filtered.map((item, i) => `
            <li role="option" class="ecl-suggest-item${i === 0 ? ' is-active' : ''}" data-i="${i}"
                aria-selected="${i === 0}">
                <span class="suggest-kind suggest-${item.kind}">${item.kind}</span>
                <span class="suggest-label">${escapeHtml(item.label)}</span>
                <span class="suggest-detail">${escapeHtml(item.detail || '')}</span>
            </li>`).join('');
        list.classList.add('active');
        list.querySelectorAll('[data-i]').forEach(node => {
            node.addEventListener('mousedown', e => { e.preventDefault(); accept(Number(node.dataset.i)); });
        });
    };

    const accept = index => {
        const item = filtered[index];
        if (!item) return;
        const caret = textarea.selectionStart;
        const word = wordBefore(textarea.value, caret);
        const from = caret - word.length;
        const before = textarea.value.slice(0, from);
        const after = textarea.value.slice(caret);
        // Keep one space after a refinement marker rather than doubling it.
        const glue = /[:,]$/.test(before.trimEnd()) && !before.endsWith(' ') ? ' ' : '';
        textarea.value = before + glue + item.insert + after;
        const pos = (before + glue + item.insert).length;
        textarea.setSelectionRange(pos, pos);
        closeList();
        paint();
        report();
        onInput?.(textarea.value);
    };

    const move = delta => {
        if (!filtered.length) return;
        active = (active + delta + filtered.length) % filtered.length;
        list.querySelectorAll('[data-i]').forEach((node, i) => {
            node.classList.toggle('is-active', i === active);
            node.setAttribute('aria-selected', String(i === active));
        });
        list.children[active]?.scrollIntoView({ block: 'nearest' });
    };

    const onKeydown = e => {
        const open = list.classList.contains('active');
        if (e.key === 'ArrowDown' && open) { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp' && open) { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter' && open) { e.preventDefault(); accept(active); }
        else if (e.key === 'Escape' && open) { e.preventDefault(); closeList(); }
        else if (e.key === ' ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openList(); }
        else if (e.key === 'Tab' && open) { closeList(); }
    };

    const onType = () => { paint(); report(); openList(); onInput?.(textarea.value); };
    const onScroll = () => { layer.scrollTop = textarea.scrollTop; layer.scrollLeft = textarea.scrollLeft; };
    const onBlur = () => setTimeout(closeList, 0);

    textarea.addEventListener('input', onType);
    textarea.addEventListener('keydown', onKeydown);
    textarea.addEventListener('scroll', onScroll);
    textarea.addEventListener('blur', onBlur);

    paint();
    report();

    return () => {
        textarea.removeEventListener('input', onType);
        textarea.removeEventListener('keydown', onKeydown);
        textarea.removeEventListener('scroll', onScroll);
        textarea.removeEventListener('blur', onBlur);
        delete textarea.dataset.enhanced;
    };
}
