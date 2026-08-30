/**
 * Page shell: theme, navigation, toasts, the changelog modal and the
 * FHIR server sign-in. Loaded by every page.
 */

import { listServers, getServer, getSelectedServerId, setSelectedServerId,
         hasServerChoice, DEFAULT_SERVER_ID } from './servers.js';
import { hasCredentials, isRemembered, setCredentials, clearCredentials,
         testCredentials, hasLiveToken } from './auth.js';
import { fetchEditionVersion } from './fhir.js';

/* ---------- icons ---------- */

/**
 * Markup for one sprite icon. The sprite is a single same-origin file, so this
 * costs one cached request for the whole site rather than a third-party icon
 * font that a locked-down network may refuse.
 */
export function icon(name, { spin = false, cls = '' } = {}) {
    const classes = ['icon', spin ? 'icon-spin' : '', cls].filter(Boolean).join(' ');
    return `<svg class="${classes}" aria-hidden="true"><use href="icons.svg#i-${name}"/></svg>`;
}

/** Point an already-rendered icon at a different symbol. */
export function setIcon(container, name) {
    const use = container?.querySelector('use');
    if (use) use.setAttribute('href', `icons.svg#i-${name}`);
}

/* ---------- small helpers ---------- */

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

let toastTimer = null;
export function showToast(message, { error = false } = {}) {
    const toast = document.getElementById('toast');
    const label = document.getElementById('toastMessage');
    if (!toast || !label) return;
    label.textContent = message;
    toast.classList.toggle('toast-error', error);
    setIcon(toast, error ? 'circle-exclamation' : 'circle-check');
    toast.classList.add('active');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('active'), error ? 6000 : 3000);
}

/* ---------- theme ---------- */

/** Light unless the visitor has explicitly chosen dark. */
function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ecl.theme', theme); } catch (e) { /* ignore */ }
    const button = document.getElementById('themeToggle');
    if (button) {
        setIcon(button, theme === 'dark' ? 'sun' : 'moon');
        button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
}

function initTheme() {
    applyTheme(currentTheme());
    document.getElementById('themeToggle')
        ?.addEventListener('click', () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
}

/* ---------- navigation ---------- */

function initNav() {
    const toggle = document.getElementById('mobileMenu');
    const links = document.getElementById('navLinks');
    if (!toggle || !links) return;

    const setOpen = open => {
        links.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
        setIcon(toggle, open ? 'xmark' : 'bars');
    };

    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    links.addEventListener('click', e => { if (e.target.tagName === 'A') setOpen(false); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && links.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
    // Never let an open mobile panel leak into the desktop layout.
    window.matchMedia('(min-width: 769px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
}

/* ---------- modals ---------- */

let lastFocused = null;

function openModal(modal) {
    lastFocused = document.activeElement;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    const target = modal.querySelector('input, button:not(.modal-close), .modal-close');
    target?.focus();
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

/** Keep Tab inside an open dialog. */
function trapFocus(modal) {
    modal.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const focusable = [...modal.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )].filter(el => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
}

/* ---------- changelog ---------- */

function parseMarkdown(markdown) {
    return escapeHtml(markdown)
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/(?:^- .+$\n?)+/gm, block => {
            const items = block.trim().split('\n')
                .map(line => `<li>${line.replace(/^- /, '')}</li>`).join('');
            return `<ul>${items}</ul>`;
        })
        .replace(/^---$/gm, '<hr>')
        .replace(/^(?!<[huol])(.+)$/gm, '<p>$1</p>')
        .replace(/<p><\/p>/g, '');
}

function initChangelog() {
    const link = document.getElementById('changelogLink');
    const modal = document.getElementById('changelogModal');
    if (!link || !modal) return;
    const body = document.getElementById('changelogContent');

    link.addEventListener('click', async e => {
        e.preventDefault();
        openModal(modal);
        if (!body || !body.querySelector('.modal-loading')) return;
        try {
            const response = await fetch('CHANGELOG.md');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            body.innerHTML = `<div class="changelog-content">${parseMarkdown(await response.text())}</div>`;
        } catch (err) {
            body.innerHTML = `<p class="modal-error">The changelog could not be loaded (${escapeHtml(err.message)}). It is also readable on GitHub.</p>`;
        }
    });

    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(modal);
    });
    trapFocus(modal);
}

/* ---------- FHIR server sign-in ---------- */

const DISMISS_KEY = 'ecl.signinDismissed';

const listeners = new Set();
/** Subscribe to connection or server changes. Called with the active server. */
export function onServerChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emitServerChange() {
    const server = activeServer();
    listeners.forEach(fn => { try { fn(server); } catch (e) { console.error(e); } });
}

export function activeServer() {
    return getServer(getSelectedServerId());
}

/** True when the active server can actually be queried right now. */
export function isConnected(server = activeServer()) {
    return server.auth.type === 'none' || hasCredentials(server.id);
}

function renderServerButton() {
    const button = document.getElementById('serverButton');
    if (!button) return;
    const server = activeServer();
    const connected = isConnected(server);
    button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="icons.svg#i-server"/></svg>
        <span class="server-button-name">${escapeHtml(server.name)}</span>
        <span class="server-dot server-dot-${connected ? 'ok' : 'warn'}"></span>`;
    button.setAttribute('aria-label',
        `${server.name}: ${connected ? 'connected' : 'not connected'}. Open server settings.`);
    button.title = `${server.name} — ${connected ? 'connected' : 'not connected'}`;
}

function serverChooser() {
    if (!hasServerChoice()) return '';
    const selected = getSelectedServerId();
    return `<div class="signin-field">
        <label for="serverChoice">FHIR server</label>
        <select id="serverChoice" class="form-control">
            ${listServers().map(s => `<option value="${escapeHtml(s.id)}" ${s.id === selected ? 'selected' : ''}>
                ${escapeHtml(s.name)} — ${escapeHtml(s.region)}</option>`).join('')}
        </select>
    </div>`;
}

function renderSignedIn(server) {
    const body = document.getElementById('serverPanelBody');
    document.getElementById('serverModalHeading').textContent = 'NMPC FHIR R4 Server';
    body.innerHTML = `
        <div class="signin-status">
            <span class="signin-status-icon"><svg class="icon" aria-hidden="true"><use href="icons.svg#i-circle-check"/></svg></span>
            <div>
                <strong>Connected to ${escapeHtml(server.name)}</strong>
                <p>${escapeHtml(server.region)} · <span data-edition-for="${escapeHtml(server.id)}">${escapeHtml(server.edition)}</span></p>
            </div>
        </div>
        <dl class="signin-meta">
            <dt>Endpoint</dt><dd><code>${escapeHtml(server.fhirBase)}</code></dd>
            <dt>Credentials</dt><dd>${isRemembered(server.id)
                ? 'Saved on this device'
                : 'Kept for this browser session only'}</dd>
        </dl>
        ${serverChooser()}
        <div class="signin-actions">
            <button type="button" class="btn btn-secondary" id="signOut">
                <svg class="icon" aria-hidden="true"><use href="icons.svg#i-right-from-bracket"/></svg> Sign out
            </button>
        </div>
        <p class="server-privacy">
            <svg class="icon" aria-hidden="true"><use href="icons.svg#i-lock"/></svg>
            Your credentials never leave your browser except to
            <code>${escapeHtml(new URL(server.auth.tokenUrl).host)}</code>. This site has no backend.
        </p>`;

    document.getElementById('signOut').addEventListener('click', () => {
        clearCredentials(server.id);
        try { sessionStorage.removeItem(DISMISS_KEY); } catch (e) { /* ignore */ }
        renderPanel();
        renderServerButton();
        emitServerChange();
        showToast('Signed out. Credentials removed from this browser.');
    });

    wireServerChooser();
    loadEditions();
}

function renderSignedOut(server) {
    const body = document.getElementById('serverPanelBody');
    document.getElementById('serverModalHeading').textContent = 'Connect a FHIR server';
    body.innerHTML = `
        <p class="signin-intro">
            ABC of ECL builds and explains ECL expressions, then runs them against a FHIR
            server. Enter the credentials you have been provided to connect.
        </p>
        <form class="signin-form" id="signinForm" novalidate>
            ${serverChooser() || `
                <div class="signin-server">
                    <span class="signin-server-label">Server</span>
                    <span class="signin-server-value">
                        <strong>${escapeHtml(server.name)}</strong>
                        <span class="signin-server-region">${escapeHtml(server.region)}</span>
                        <code>${escapeHtml(server.fhirBase)}</code>
                    </span>
                </div>`}
            <div class="signin-field">
                <label for="credClientId">Client ID</label>
                <input type="text" id="credClientId" autocomplete="username" spellcheck="false"
                       autocapitalize="none" placeholder="your-client-id" required>
            </div>
            <div class="signin-field">
                <label for="credClientSecret">Client secret</label>
                <div class="signin-secret">
                    <input type="password" id="credClientSecret" autocomplete="current-password"
                           spellcheck="false" placeholder="••••••••••••••••" required>
                    <button type="button" class="signin-reveal" id="revealSecret"
                            aria-label="Show secret" title="Show secret">
                        <svg class="icon" aria-hidden="true"><use href="icons.svg#i-eye"/></svg>
                    </button>
                </div>
            </div>
            <label class="signin-remember">
                <input type="checkbox" id="credRemember">
                <span>Remember on this device
                    <small>Leave unticked on a shared computer — credentials are then forgotten when you close the tab.</small>
                </span>
            </label>
            <p class="signin-error" id="signinError" role="alert" hidden></p>
            <button type="submit" class="btn btn-primary btn-block" id="signinSubmit">
                <svg class="icon" aria-hidden="true"><use href="icons.svg#i-right-to-bracket"/></svg> Connect
            </button>
        </form>
        <p class="server-privacy">
            <svg class="icon" aria-hidden="true"><use href="icons.svg#i-lock"/></svg>
            Sent only to <code>${escapeHtml(new URL(server.auth.tokenUrl).host)}</code> and stored in this
            browser. This site is fully static and has no backend, so nothing reaches it.
        </p>
        <p class="signin-help">
            ${escapeHtml(server.auth.note || 'Credentials are issued by whoever operates the server.')}
            ${server.docsUrl ? `<a href="${escapeHtml(server.docsUrl)}" target="_blank" rel="noopener">About this server</a>` : ''}
        </p>`;

    const form = document.getElementById('signinForm');
    const errorEl = document.getElementById('signinError');
    const submit = document.getElementById('signinSubmit');
    const secret = document.getElementById('credClientSecret');

    document.getElementById('revealSecret').addEventListener('click', e => {
        const show = secret.type === 'password';
        secret.type = show ? 'text' : 'password';
        setIcon(e.currentTarget, show ? 'eye-slash' : 'eye');
        e.currentTarget.setAttribute('aria-label', show ? 'Hide secret' : 'Show secret');
    });

    const showError = message => {
        errorEl.textContent = message;
        errorEl.hidden = false;
    };

    form.addEventListener('submit', async e => {
        e.preventDefault();
        errorEl.hidden = true;

        const target = getServer(document.getElementById('serverChoice')?.value || server.id);
        const clientId = document.getElementById('credClientId').value.trim();
        const clientSecret = secret.value.trim();
        const remember = document.getElementById('credRemember').checked;

        if (!clientId || !clientSecret) {
            showError('Enter both a client ID and a secret.');
            return;
        }

        submit.disabled = true;
        submit.innerHTML = '<svg class="icon icon-spin" aria-hidden="true"><use href="icons.svg#i-spinner"/></svg> Connecting…';
        try {
            // Verify before storing, so a bad secret is never persisted.
            await testCredentials(target, clientId, clientSecret);
            setCredentials(target.id, clientId, clientSecret, { remember });
            setSelectedServerId(target.id);
            renderPanel();
            renderServerButton();
            emitServerChange();
            closeModal(document.getElementById('serverModal'));
            showToast(`Connected to ${target.name}`);
        } catch (err) {
            showError(err.message);
            submit.disabled = false;
            submit.innerHTML = '<svg class="icon" aria-hidden="true"><use href="icons.svg#i-right-to-bracket"/></svg> Connect';
            secret.focus();
            secret.select();
        }
    });

    wireServerChooser();
}

function wireServerChooser() {
    document.getElementById('serverChoice')?.addEventListener('change', e => {
        setSelectedServerId(e.target.value);
        renderPanel();
        renderServerButton();
        emitServerChange();
    });
}

function renderPanel() {
    const server = activeServer();
    if (!document.getElementById('serverPanelBody')) return;
    if (isConnected(server)) renderSignedIn(server);
    else renderSignedOut(server);
}

/** Show the live edition/version for a connected server. */
async function loadEditions() {
    const server = activeServer();
    if (!isConnected(server)) return;
    const version = await fetchEditionVersion(server);
    if (!version) return;
    const stamp = version.split('/version/')[1];
    document.querySelectorAll(`[data-edition-for="${server.id}"]`).forEach(el => {
        el.textContent = stamp ? `${server.edition} · ${stamp}` : server.edition;
    });
}

export function openServerPanel() {
    const modal = document.getElementById('serverModal');
    if (!modal) return;
    renderPanel();
    openModal(modal);
    if (isConnected()) loadEditions();
}

function initServerPanel() {
    const button = document.getElementById('serverButton');
    const modal = document.getElementById('serverModal');
    if (!button || !modal) return;

    // A saved selection pointing at a server that is no longer offered would
    // strand the visitor, so normalise it before anything renders.
    if (!listServers().some(s => s.id === getSelectedServerId())) {
        setSelectedServerId(DEFAULT_SERVER_ID);
    }

    renderServerButton();
    renderPanel();

    button.addEventListener('click', openServerPanel);
    modal.querySelector('.modal-close')?.addEventListener('click', () => {
        closeModal(modal);
        // Remember the dismissal so reading the other pages is not interrupted.
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
    });
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            closeModal(modal);
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal(modal);
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
        }
    });
    trapFocus(modal);

    // Prompt on arrival when there is nothing to query with, unless the visitor
    // already dismissed it in this session.
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { /* ignore */ }
    if (!isConnected() && !dismissed) {
        openModal(modal);
    } else if (isConnected() && !hasLiveToken(activeServer().id)) {
        loadEditions();
    }
}

/* ---------- smooth scrolling ---------- */

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            const href = anchor.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
            window.scrollTo({ top, behavior: 'smooth' });
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        });
    });
}

/* ---------- "try it" links ---------- */

/**
 * Turn any element carrying `data-ecl` into a link that opens the builder with
 * that expression loaded, so a reader is never shown an expression they cannot
 * run. Anchors keep a plain `builder.html` href as a no-JS fallback.
 */
function initTryLinks() {
    document.querySelectorAll('[data-ecl]').forEach(node => {
        const ecl = node.getAttribute('data-ecl');
        if (!ecl) return;
        const href = `builder.html?ecl=${encodeURIComponent(ecl)}`;
        if (node.tagName === 'A') node.setAttribute('href', href);
        else {
            node.style.cursor = 'pointer';
            node.addEventListener('click', () => { location.href = href; });
        }
    });

    document.querySelectorAll('[data-ecl-block]').forEach(block => {
        const ecl = block.getAttribute('data-ecl-block');
        if (!ecl || block.querySelector('.try-inline')) return;
        const link = document.createElement('a');
        link.className = 'try-inline';
        link.href = `builder.html?ecl=${encodeURIComponent(ecl)}`;
        link.innerHTML = '<svg class="icon" aria-hidden="true"><use href="icons.svg#i-play"/></svg> Try it';
        block.appendChild(link);
    });
}

/* ---------- footer year ---------- */

function initFooterYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = year; });
}

/* ---------- offline support ---------- */

function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('Offline support unavailable:', err.message);
        });
    });
}

export function initShell() {
    initTheme();
    initNav();
    initChangelog();
    initServerPanel();
    initSmoothScroll();
    initTryLinks();
    initFooterYear();
    initServiceWorker();
}
