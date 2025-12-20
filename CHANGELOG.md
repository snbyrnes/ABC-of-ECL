# Changelog

All notable changes to ABC of ECL will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.3.0] - 2025-12-20

### Added
- **ECL Query Anatomy Panel** — Collapsible panel that breaks down each ECL query component with explanations
  - Color-coded items: operators (pink), concepts (green), attributes (blue), values (orange)
  - Detailed explanations for ECL operators (`<<`, `<`, `:`, `=`, `AND`, `OR`, etc.)
  - Knowledge base of common SNOMED CT concepts with clinical context
  - Practical tips for when to use each operator
- **Page Guide** — "How to use this page" collapsible guide on the Builder page
  - Explains each section: Templates, Description, Parameters, ECL Output, Anatomy, Results
  - Remembers collapsed state in localStorage
- **Feedback Section** — "Project Under Development" section on home page
  - Links to GitHub Issues for bug reports and suggestions
- **Enhancement Roadmap** — New `roadmap.md` documenting planned features

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
- URL parameter support for loading examples directly (`?example=paracetamol`)
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
