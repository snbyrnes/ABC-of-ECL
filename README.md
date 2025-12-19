# ABC of ECL

An interactive web app for learning SNOMED CT Expression Constraint Language (ECL), focused on medicines and clinical terminology.

🔗 **Live Demo:** [snbyrnes.github.io/ABC-of-ECL](https://snbyrnes.github.io/ABC-of-ECL/)

![ECL Query Builder](https://img.shields.io/badge/SNOMED-ECL-blue) ![GitHub Pages](https://img.shields.io/badge/Hosted-GitHub%20Pages-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## What is ECL?

Expression Constraint Language (ECL) is a formal syntax for querying SNOMED CT clinical terminology. It allows you to define sets of clinical concepts using operators like:

| Operator | Meaning |
|----------|---------|
| `<` | Descendants of |
| `<<` | Descendants or self |
| `>` | Ancestors of |
| `>>` | Ancestors or self |
| `:` | Refinement (with attributes) |
| `^` | Member of reference set |

---

## Features

- **15+ Query Templates** — Pre-built templates for medicines, clinical findings, and procedures
- **Live Concept Search** — Search SNOMED CT concepts in real-time
- **Plain English Descriptions** — Understand what each query does before running it
- **ECL Generation** — Watch queries build as you configure parameters
- **Real Results** — Execute against CSIRO Ontoserver FHIR API
- **Dark/Light Theme** — Toggle between themes
- **Fully Static** — Runs entirely in the browser

---

## Quick Start

### Option 1: Use the live site
Visit [snbyrnes.github.io/ABC-of-ECL](https://snbyrnes.github.io/ABC-of-ECL/)

### Option 2: Run locally
```bash
git clone https://github.com/snbyrnes/ABC-of-ECL.git
cd ABC-of-ECL
# Open index.html in your browser
```

No build step or dependencies required.

---

## Project Structure

```
ABC-of-ECL/
├── index.html          # Main HTML
├── styles.css          # Styles (light/dark themes)
├── app.js              # Application logic & FHIR integration
├── .nojekyll           # GitHub Pages config
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions deployment
```

---

## Terminology Server

This app queries the public **CSIRO Ontoserver** FHIR R4 endpoint:

```
https://r4.ontoserver.csiro.au/fhir
```

Uses the `ValueSet/$expand` operation with ECL-based value set URLs.

---

## Deployment

Automatically deploys to GitHub Pages on push to `main` via GitHub Actions.

To deploy your own:
1. Fork this repository
2. Go to **Settings → Pages → Source → GitHub Actions**
3. Push to `main` branch

---

## Resources

- [ECL Specification](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-expression-constraint-language/)
- [SNOMED CT Browser](https://browser.ihtsdotools.org/)
- [Ontoserver Documentation](https://confluence.csiro.au/display/FHIR/Ontoserver)

---

## License

MIT — Free for educational and commercial use.

---

## Disclaimer

For educational purposes only. Not for clinical decision-making. SNOMED CT® is a trademark of SNOMED International.
