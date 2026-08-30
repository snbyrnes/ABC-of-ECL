# ABC of ECL - Roadmap

> **Target audience:** Clinical informaticians
> **Primary server:** HSE National Medicinal Product Catalogue (Ireland)
> **Focus:** Medication data and real-world prescribing/dispensing scenarios

---

## Status

| # | Item | Status |
|---|------|--------|
| 1 | ECL Query Anatomy panel | ✅ v1.3.0, extended in v2.0.0 |
| 2 | Clinical scenarios | ✅ v2.0.0 — built into the builder, not a separate page |
| 3 | Query comparison tool | ✅ v2.0.0 |
| 4 | Multi-server support | ✅ v2.0.0 — registry built; Ireland only by choice |
| 5 | Shareable links | ✅ v2.0.0 |
| 6 | ECL playground (highlighting, validation, autocomplete) | ✅ v2.0.0 |
| 7 | Value set export | ✅ v2.0.0 |
| 8 | PKCE authentication | ⬜ Blocked on HSE registering a public client |
| 9 | Self-hosted fonts and icons | ✅ v2.0.0 |

---

## 6. ECL Playground — delivered

The custom query template is now an editor: syntax highlighting driven by the
anatomy tokeniser, advisory diagnostics, and autocomplete for attributes and
reference sets.

Diagnostics cover unbalanced brackets, an unclosed `|` term, a trailing
operator, a refinement with no attribute value, and unparseable input. Concept
identifiers are checked against their Verhoeff check digit, so a mistyped ID is
reported as mistyped rather than silently returning nothing.

Validation never blocks a query. The server is the authority on what is valid;
this only points at what is almost certainly a mistake.

### Still possible
- Highlight the specific span a diagnostic refers to, rather than naming it
- Concept search inline in the editor, as the pickers already do

---

## 7. Value Set Export — delivered

A query exports as a FHIR ValueSet whose `compose` rule is the ECL, with the
SNOMED edition pinned so the definition is reproducible. Copy the definition, or
download it with the expansion attached; a partial expansion says so in a
parameter rather than looking complete.

### Still possible
- Import a ValueSet back into the builder, reading the ECL out of its compose rule

---

## 8. PKCE Authentication

Today a visitor pastes their own HSE client ID and secret, which are kept in their browser and
sent only to the HSE token endpoint. It works, but a `client_credentials` secret is not really
meant to live in a browser.

### Wanted
Authorization code flow with PKCE, where each person signs in as themselves and no secret
exists at all.

### Blocked on
HSE registering a **public** client for this site, with the GitHub Pages URL as a permitted
redirect URI. The Keycloak realm already advertises `authorization_code` and PKCE `S256`, so
nothing is missing on the protocol side.

### Notes
[`js/auth.js`](js/auth.js) is written so a second grant type slots in beside the existing one;
`servers.js` declares the auth type per server.

### Effort
Low once the client exists

---

## Next horizon: reaching people outside Ireland

The site currently requires HSE credentials to do anything, which rules out every
learner who does not have them. The public CSIRO Ontoserver carries 16 SNOMED
editions with no authentication at all, including:

- the **International release** (17 versions held)
- **UK**, **Australia**, **Netherlands**, **Sweden**, **Spain**, **Argentina**,
  **Canada**, **New Zealand** and **US** modules
- the **Global Patient Set** — SNOMED International's licence-free subset, usable
  in non-member countries, which is the only honest answer to "free for anyone,
  anywhere"

Measured 30 August 2026, the same expression answers very differently by edition:

| Edition | `<< 763158003 \|Medicinal product\|` |
|---|---|
| United Kingdom | 105,532 |
| Australia | 59,445 |
| Ireland (NMPC) | 39,400 |
| International | 25,045 |
| Global Patient Set | 24,896 |
| Netherlands | 21,469 |
| IPS terminology | 1,743 |

### 10. Anonymous access

Unhide the public server, default visitors with no credentials to it, and keep
NMPC as what signing in gives you. Close to a configuration change — every
template was tested against both servers before the site narrowed to Ireland.

**Effort:** Low. **Unblocks:** everything below.

### 11. Cross-edition comparison

Run one expression against several editions at once and show the differences.
Nothing else does this, and it is the comparison engine already shipped, pointed
at servers instead of expressions. Version-pinned expansion is confirmed working:
pass `http://snomed.info/sct/{module}/version/{date}` as the value set system.

**Effort:** Medium.

### 12. Release diff

The same expression against two versions of one edition. `<< 73211009
|Diabetes mellitus|` returns 120 concepts in the 2026-06 International release
and 121 in 2024-01. "What changed, and does it break my value set?" is a real
twice-yearly job currently done by hand.

**Effort:** Medium, and it reuses the same engine again.

### 13. A page per question

Six pages today. People search for "SNOMED ECL descendants operator" and "how to
find all products containing X". Generating an indexed page per operator and per
scenario, each with a live query, is a build-step change and the largest lever on
whether anyone outside Ireland ever arrives.

**Effort:** Medium.

### Risk to watch

Depending on someone else's public demo server for a global audience is a real
dependency. Worth a conversation with CSIRO before it becomes load-bearing.

---

## Ideas not yet scheduled

- **Hierarchy walker** — click through parents and children without writing ECL each time
- **Attribute discovery** — show which attributes are actually populated on a concept, so you
  can see what is worth refining on
- **Saved queries** — history currently lasts one session only
- **More national servers** — the server registry supports it; each needs endpoint details,
  auth arrangements and a description of its drug model
- **Diff across releases** — run the same expression against two SNOMED versions and show what
  changed, using the comparison engine that already exists

---

*Last updated: 30 August 2026*
