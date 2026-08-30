# Changelog

All notable changes to ABC of ECL will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.0.0] - 2026-08-30

A rebuild around the HSE National Medicinal Product Catalogue, plus fixes for
templates that generated ECL contradicting their own descriptions.

### Added
- HSE NMPC (Ireland) is now the terminology server, with the Irish dm+d-style
  drug model: VTM, VMP, VMPP, AMP, AMPP and ATM reference sets
- Sign-in modal for entering your own HSE client ID and secret. Credentials are
  verified before being stored, kept in session storage by default with an opt-in
  "remember on this device", and removed by signing out
- Server registry supports further national servers as a configuration change;
  this deployment is Ireland only
- Compare page: run two expressions side by side and list the concepts that appear
  in only one of them
- Clinical scenario templates: prescribing to dispensing, allergy exclusion,
  dose-based prescribing, reference set membership
- Irish extension templates: products by manufacturer, by legal status, packs by size
- Shareable query links via `?ecl=`; every ECL snippet on the site now opens in the builder
- Result actions: copy a concept ID, open it in the SNOMED browser, or use it as the
  focus concept of a new query
- Pagination for result sets larger than one page
- Export results as CSV or JSON
- Query history for the current session
- Keyboard navigation and combobox ARIA roles on concept search
- Service worker, so the app shell genuinely works offline
- `MINUS`, numeric `#` and string values in the query anatomy breakdown
- Anatomy now warns when a term written in the ECL disagrees with the concept ID
- Compare page reports when a result set exceeded the comparison cap, rather than
  silently truncating
- 404 page
- CI: shared-markup sync check, local-reference check, module syntax check,
  monthly concept-freshness check that opens an issue when an ID goes inactive
- `og-image.png` and the PNG icons the manifest had always referenced

- ECL editor on the custom query template: syntax highlighting, advisory
  validation and attribute autocomplete. Concept identifiers are checked against
  their Verhoeff check digit, which catches every single-digit typo and every
  adjacent transposition before a request is sent
- Export a query as a FHIR ValueSet, with the ECL preserved as the compose rule
  and the SNOMED edition pinned, so the definition travels rather than just
  today's expansion. Copy the definition, or download it with the expansion
- Self-hosted fonts and a generated icon sprite, replacing Google Fonts and the
  Font Awesome CDN. The site now makes no third-party requests at all

### Fixed
- **VTM Related Products** generated ECL identical to Products by Ingredient, while
  describing itself as navigating the VTM hierarchy. Replaced with templates built on
  the real product-level reference sets.
- **Packaged Clinical Drugs** described itself as returning packaged products but
  generated "any product with any ingredient". Replaced with pack-level templates.
- `411116001` was labelled "Has dose form" on the examples page and
  "Has manufactured dose form" in the builder. It is the latter everywhere now.
- Mobile navigation did not open: the CSS hid it with no mobile panel styling, and the
  toggle set an inline style that then overrode the media query on resize
- The manifest referenced `icon-192.png` and `icon-512.png`, neither of which existed,
  so the app was not installable
- Resources page said "click on any operator" when the operators were not clickable
- Dark theme flashed white on every page load; the theme is now applied before first paint
- `apple-touch-icon` pointed at an SVG, which iOS ignores
- Sitemap listed both `/` and `/index.html`, contradicting the canonical tag
- Concept search could apply an older response over a newer one, and a single shared
  debounce timer meant two pickers would cancel each other
- Server errors dumped a raw FHIR OperationOutcome into the results panel
- Removed `handleExampleClick`, forty lines of dead code bound to a selector that
  matched nothing on any page

### Changed
- **Scoped to medicines.** The clinical findings and procedures templates were
  removed, and the syntax and operator references rewritten onto medicines
  concepts, so the whole site reads as one subject. The home page now reads
  "Learn ECL for Medicines Terminology"
- **Light is the default theme.** Dark is opt-in through the toggle and persists;
  it no longer follows the operating system setting
- The builder now opens with a template selected, generated and executed, instead of
  five placeholder panels
- Query anatomy is expanded by default; the Page Guide that restated the panel headings
  has been removed
- Home page reordered so "What is ECL?" precedes the numbered steps that referred to it,
  and the duplicate call-to-action block was removed
- `app.js` (1,502 lines, global scope, loaded on every page) split into ES modules
- Navigation, footer and modals moved to `partials/` with a build step, replacing four
  copy-pasted versions
- Templates are now defined against the selected server's model rather than hard-coded
  concept IDs
- Fonts and icons are served from this origin. A locked-down hospital network
  that blocks a CDN no longer strips the site of its icons and typography:
  12 kB of sprite and 78 kB of subsetted variable fonts, against Font Awesome's
  100 kB of CSS plus its webfonts
- Every result and suggestion is HTML-escaped

### Known scope

This release is Ireland only and requires HSE credentials. The server registry
supports further national servers as a configuration change, and a second entry
(CSIRO Ontoserver) is present but hidden. See [roadmap.md](roadmap.md) for the
case for opening anonymous access.

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
