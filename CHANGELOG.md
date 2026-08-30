# Changelog

All notable changes to ABC of ECL will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.0.0] - 2026-08-30

Rebuilt around the HSE National Medicinal Product Catalogue, with the Irish
dm+d-style drug model and a corrected set of query templates.

### Added
- HSE NMPC (Ireland) as the FHIR server, using the Irish drug model: VTM, VMP,
  VMPP, AMP, AMPP and ATM reference sets
- Sign-in panel for your own client ID and secret. Credentials are verified
  before being stored, held in session storage by default with an opt-in
  "remember on this device", and removed by signing out
- Server registry with per-server drug models, so adding a server is configuration
- Compare page — run two expressions side by side and list the concepts that
  appear in only one of them
- Clinical scenario templates: prescribing to dispensing, allergy exclusion,
  dose-based prescribing, reference set membership
- Irish extension templates: products by manufacturer, by legal status, packs by size
- ECL editor on the custom query template: syntax highlighting, advisory
  validation and attribute autocomplete. Concept identifiers are checked against
  their check digit, so a mistyped ID is reported rather than silently returning
  nothing
- Export a query as a FHIR ValueSet, with the ECL preserved as the compose rule
  and the SNOMED edition pinned. Copy the definition, or download it with the
  expansion attached
- Shareable query links via `?ecl=`; every ECL snippet on the site opens in the builder
- Result actions: copy a concept ID, open it in the SNOMED browser, or use it as
  the focus concept of a new query
- Pagination, CSV and JSON export, and per-session query history
- Keyboard navigation and combobox ARIA roles on concept search
- Service worker for offline access to the app shell
- `MINUS`, numeric `#` and string values in the query anatomy breakdown
- Anatomy warns when a term written in the ECL disagrees with its concept ID
- Compare reports when a result set exceeded the comparison cap rather than
  truncating silently
- 404 page, social preview image and the PNG app icons
- CI checks on every change: shared markup in sync, local references resolve,
  generated assets current, modules parse. A monthly job verifies every
  hard-coded concept ID is still active

### Fixed
- Two medicines templates generated ECL that did not match their descriptions.
  "VTM Related Products" produced the same expression as Products by Ingredient,
  and "Packaged Clinical Drugs" returned any product with any ingredient. Both
  are replaced by templates built on the real product-level reference sets
- `411116001` was labelled "Has dose form" on one page and "Has manufactured dose
  form" on another; it is the latter everywhere
- Mobile navigation did not open
- The manifest referenced icons that were not present, so the app was not installable
- The Resources page invited readers to click operators that were not clickable
- The dark theme flashed white on page load; the theme is applied before first paint
- `apple-touch-icon` pointed at an SVG, which iOS ignores
- The sitemap listed a URL that contradicted its page's canonical tag
- Concept search could apply an older response over a newer one
- Server errors showed a raw FHIR OperationOutcome instead of a readable message

### Changed
- Scoped to medicines. The clinical findings and procedures templates were removed
  and the syntax and operator references rewritten onto medicines concepts
- Light is the default theme; dark is opt-in through the toggle
- The builder opens with a template selected, generated and executed
- Query anatomy is expanded by default; the page guide has been removed
- Home page reordered so "What is ECL?" precedes the steps that refer to it
- `app.js` split into ES modules; navigation, footer and modals moved to shared
  partials with a build step
- Templates are defined against the selected server's model rather than
  hard-coded concept IDs
- Fonts and icons are served from this origin, so the site makes no third-party
  requests
- Server responses are HTML-escaped throughout

---

## [1.4.0] - 2025-12-20

### Added
- Meta descriptions and keywords on all pages
- Open Graph tags for social sharing
- Canonical URLs to prevent duplicate content
- JSON-LD structured data for search engines
- XML sitemap for search engine crawling
- Robots.txt with sitemap reference
- Google Search Console verification meta tag
- SVG favicon with brand colors
- Web app manifest for installability
- App shortcuts to Query Builder and Examples
- Apple touch icon support
- Skip-to-content links on all pages
- ARIA labels on navigation and main sections
- Semantic main landmark wrapper

### Changed
- Improved page titles with keywords for better search ranking
- Added skip-link CSS styling

---

## [1.3.0] - 2025-12-20

### Added
- ECL Query Anatomy panel with collapsible breakdown of each query component
- Color-coded syntax items for operators, concepts, attributes, and values
- Detailed explanations for ECL operators
- Knowledge base of common SNOMED CT concepts with clinical context
- Page Guide collapsible section on the Builder page
- Feedback section with links to GitHub Issues for bug reports
- Enhancement roadmap documenting planned features

### Changed
- Query Anatomy panel is collapsed by default
- Reduced height of empty Query Parameters placeholder

---

## [1.2.0] - 2025-12-19

### Added
- Changelog modal popup accessible from footer on all pages
- Press Escape or click outside to close modal
- Markdown parsing for changelog display

### Changed
- Footer now includes changelog link across all pages

---

## [1.1.0] - 2025-12-19

### Added
- Multi-page site structure with dedicated pages for Builder, Examples, and Resources
- ECL syntax quick reference section on Examples page
- Additional learning resources on Resources page
- Server information panel with Ontoserver details
- URL parameter support for loading examples directly
- Active navigation state highlighting

### Changed
- Reorganized home page to focus on introduction and ECL overview
- Improved navigation with proper page links
- Enhanced examples page with syntax reference cards

---

## [1.0.1] - 2025-12-19

### Fixed
- ECL output display now shows clean syntax without broken highlighting markup

### Changed
- Updated footer copyright year to 2025

---

## [1.0.0] - 2025-12-19

### Added
- Initial release
- Interactive ECL Query Builder with 15+ templates
- Live concept search against CSIRO Ontoserver FHIR R4
- Query templates for medicines, clinical findings, and procedures
- Plain English descriptions for each query type
- Real-time ECL generation
- Dark/light theme toggle
- Copy to clipboard functionality
- Example queries with "Try it" feature
- Resource links to official SNOMED documentation
- GitHub Actions deployment workflow
- Responsive design for all devices
