# ABC of ECL

An interactive web app for learning SNOMED CT Expression Constraint Language (ECL), focused on medicines terminology.

🔗 **Live site:** [snbyrnes.github.io/ABC-of-ECL](https://snbyrnes.github.io/ABC-of-ECL/)

![SNOMED ECL](https://img.shields.io/badge/SNOMED-ECL-blue) ![GitHub Pages](https://img.shields.io/badge/Hosted-GitHub%20Pages-green) ![License](https://img.shields.io/badge/License-Apache_2.0-yellow)

---

## What it does

The builder never starts empty. Sign in and a real query is already running against the Irish
National Medicinal Product Catalogue, with every operator in the expression explained beside it.
Change the ingredient, change the product level, and watch the ECL and the result count move
together.

- **15 query templates** across clinical scenarios, medicines and basic ECL
- **Live against the Irish catalogue** — the HSE National Medicinal Product Catalogue
- **Query anatomy** — a breakdown of every operator, concept and attribute in the expression
- **Compare mode** — run two expressions side by side and list the concepts only one of them selects
- **Shareable links** — every query produces a URL; every ECL snippet on the site is one click from running
- **Result actions** — copy an ID, open it in the SNOMED browser, or use it as the focus of the next query
- **Export** — copy results as CSV or JSON, or export the query as a FHIR ValueSet
- **ECL editor** — syntax highlighting, live validation and attribute autocomplete on custom queries
- **No third-party requests** — fonts and icons are served from this origin
- **Works offline** — a service worker caches the app shell (queries still need a network)
- **Light by default**, with dark opt-in, applied before first paint

---

## Terminology server

Every query runs against the **HSE National Medicinal Product Catalogue**, the Irish national
terminology server.

| | |
|---|---|
| Endpoint | `https://nmpc.hse.ie/production1/fhir` |
| Edition | Irish drugs module (`1601000220105`) + SNOMED CT International |
| Auth | OAuth2 client credentials, entered by each user |
| Drug model | dm+d style: VTM → VMP → AMP, with VMPP/AMPP packs and ATM |

The site is Ireland-only today. The registry in [`js/servers.js`](js/servers.js) describes each
endpoint alongside its drug model, and templates are written against that description rather
than hard-coded concept IDs, so adding another national server is a configuration change. A
second entry (CSIRO Ontoserver) is present but flagged `hidden: true` — it stays covered by the
tests and can be re-enabled with one flag.

### Signing in

Opening the site prompts for an HSE-issued client ID and secret. This is deliberate: ABC of ECL
is fully static and served from a public repository, so it can never hold a client secret of
its own — anything committed here would be world-readable.

- Credentials are verified against the HSE token endpoint **before** being stored, so a bad
  secret is never persisted
- They go to **sessionStorage** by default and are forgotten when the tab closes
- Ticking **"Remember on this device"** promotes them to `localStorage`
- They are sent only to `nmpc.hse.ie` and reach no server belonging to this project
- **Sign out** removes them from both stores

The HSE Keycloak realm also supports `authorization_code` with PKCE, which needs no secret at
all. If a public client is registered for this site, that becomes the better option and
[`js/auth.js`](js/auth.js) is written so a second grant type slots in beside the existing one.

---

## Templates

**Clinical scenarios** — Prescribing to dispensing · Allergy exclusion · Dose-based prescribing · Reference set membership

**Medicines** — Products by ingredient · Products by dose form · Browse a product level · Products by manufacturer · Products by legal status · Packs by size

**Basic ECL** — Descendants · Ancestors · Direct children · Member of · Custom query

The site covers medicines. The server also carries the SNOMED CT International release, so a
custom query can reach beyond the drug model when you need it to.

Templates are written against the *model description* of the selected server rather than
hard-coded concept IDs, so the same template produces correct ECL on any server whose model is
described. A template that cannot be expressed on a server's model is hidden rather than
approximated.

---

## Exporting a query

Results copy as CSV or JSON. A query also exports as a **FHIR ValueSet** whose
`compose` rule is the ECL itself, with the SNOMED edition pinned — so the
definition travels and can be re-expanded later, rather than freezing today's
answer. The downloaded file additionally carries the concepts loaded so far, and
says so explicitly when that is only part of the set.

The exported resource is tested by posting it back to the server and confirming
it expands to the same concepts.

---

## Running locally

```bash
git clone https://github.com/snbyrnes/ABC-of-ECL.git
cd ABC-of-ECL
```

The site is plain static HTML. Because it uses ES modules, open it through a local server
rather than `file://`:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

No build step, no dependencies, no bundler.

---

## Project structure

```
ABC-of-ECL/
├── index.html              # Home
├── builder.html            # Query builder
├── compare.html            # Side-by-side query comparison
├── examples.html           # Worked examples & syntax reference
├── resources.html          # Operator reference, server details, docs
├── 404.html
├── styles.css
├── sw.js                   # Service worker (app shell caching)
├── manifest.json
├── icons.svg               # Generated icon sprite
├── fonts/                  # Self-hosted variable fonts (latin subsets)
├── js/
│   ├── servers.js          # Server registry + drug model descriptions
│   ├── auth.js             # OAuth2 client credentials, browser-side
│   ├── fhir.js             # $expand / $lookup client, paging, error mapping
│   ├── templates.js        # Query templates
│   ├── anatomy.js          # ECL tokeniser and explanations
│   ├── playground.js       # Highlighting, validation, autocomplete
│   ├── valueset.js         # FHIR ValueSet export
│   ├── shell.js            # Nav, theme, toasts, icons, server sign-in
│   ├── builder.js          # Builder page
│   ├── compare.js          # Compare page
│   └── page.js             # Entry point for content pages
├── partials/               # Shared markup — edit here, not in the pages
├── build.js                # Inlines partials into the pages
└── tools/
    ├── make-images.js      # Generates app icons and the social card
    ├── make-icon-sprite.js # Generates icons.svg from the icons in use
    ├── check-assets.js     # Every local reference and icon symbol must resolve
    ├── check-links.js      # Outbound link check
    └── verify-concepts.js  # Every hard-coded concept ID must still be active
```

### Assets

Nothing is loaded from a third party. Icons come from a generated sprite
containing only the glyphs the site actually uses, and the two fonts are
self-hosted latin subsets.

```bash
node tools/make-icon-sprite.js   # after adding or removing an icon
```

The generator scans for all three ways an icon can be referenced — a sprite
reference in markup, an `icon('name')` call, or an `icon: 'fa-name'` entry in
data — and CI fails if the committed sprite is out of date. `check-assets.js`
separately verifies that every referenced symbol exists, because a missing one
renders as nothing at all.

Icons are Font Awesome Free (CC BY 4.0). Inter and JetBrains Mono are SIL OFL 1.1.

### Editing shared markup

The navigation, footer and modals live in `partials/`. They are inlined into each page by
`build.js`, so the pages stay plain HTML with no runtime templating and no flash of unstyled
navigation.

```bash
node build.js           # after editing anything in partials/
node build.js --check   # what CI runs; fails if a page is out of date
```

### Checks

```bash
node tools/check-assets.js       # local references, icon symbols, duplicate ids, manifest, sitemap
node tools/check-links.js        # outbound links
node tools/verify-concepts.js    # concept IDs still active (set NMPC_CLIENT_ID/SECRET for Irish IDs)
node tools/make-images.js        # regenerate app icons and og-image.png
node tools/make-icon-sprite.js   # regenerate icons.svg
```

`check-assets.js` exists because a manifest once shipped pointing at icons that were never
committed. It now fails the build instead.

`verify-concepts.js` runs monthly in CI. SNOMED releases twice a year and concepts get
inactivated between releases; without the check, a stale ID shows up as an empty result set and
a learner assumes they wrote the query wrong.

---

## Deployment

Pushes to `main` run the checks, then deploy to GitHub Pages. Pull requests run the checks only.

To deploy your own copy:

1. Fork the repository
2. **Settings → Pages → Source → GitHub Actions**
3. Push to `main`

Optional repository secrets `NMPC_CLIENT_ID` and `NMPC_CLIENT_SECRET` let the monthly
terminology check validate Irish extension concept IDs. Without them those IDs are reported as
skipped rather than failing the run.

---

## Contributing

Bug reports, terminology corrections and new template ideas are all welcome.

- 🐛 [GitHub Issues](https://github.com/snbyrnes/ABC-of-ECL/issues)
- 📋 [Roadmap](roadmap.md)
- 📝 [Changelog](CHANGELOG.md)

---

## Resources

- [ECL specification](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-expression-constraint-language/)
- [SNOMED CT browser](https://browser.ihtsdotools.org/)
- [HSE NMPC browser](https://nmpc.hse.ie/browser)
- [FHIR terminology services](https://www.hl7.org/fhir/terminology-service.html)

---

## Disclaimer

For educational purposes only. Not for clinical decision-making. Always verify terminology
against an authoritative source before using it in a clinical system.

SNOMED CT® is a trademark of SNOMED International.
