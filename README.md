# ABC of ECL

An interactive web app for learning SNOMED CT Expression Constraint Language (ECL), focused on medicines and clinical terminology.

🔗 **Live Demo:** [snbyrnes.github.io/ABC-of-ECL](https://snbyrnes.github.io/ABC-of-ECL/)

![ECL Query Builder](https://img.shields.io/badge/SNOMED-ECL-blue) ![GitHub Pages](https://img.shields.io/badge/Hosted-GitHub%20Pages-green) ![License](https://img.shields.io/badge/License-Apache_2.0-yellow)

<img width="2690" height="1416" alt="image" src="https://github.com/user-attachments/assets/9932a124-28b7-498c-a91d-be544cbfe3c8" />

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

- **Multi-Page Site** — Dedicated pages for Home, Builder, Examples, and Resources
- **15+ Query Templates** — Pre-built templates for medicines, clinical findings, and procedures
- **Live Concept Search** — Search SNOMED CT concepts in real-time
- **Plain English Descriptions** — Understand what each query does before running it
- **ECL Query Anatomy** — Interactive breakdown explaining each part of the ECL syntax
- **Page Guide** — Collapsible guide explaining how to use each section
- **ECL Generation** — Watch queries build as you configure parameters
- **Real Results** — Execute against CSIRO Ontoserver FHIR API
- **Syntax Reference** — Quick reference cards for ECL operators
- **Dark/Light Theme** — Toggle between themes
- **Changelog Modal** — View version history from footer link
- **Fully Static** — Runs entirely in the browser

<img width="2561" height="1279" alt="image" src="https://github.com/user-attachments/assets/9f051d78-ed04-42d9-9b90-17dfae0c5a20" />

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
├── index.html          # Home page - Introduction to ECL
├── builder.html        # Interactive ECL Query Builder
├── examples.html       # Example queries & syntax reference
├── resources.html      # Documentation & learning resources
├── styles.css          # Styles (light/dark themes)
├── app.js              # Application logic & FHIR integration
├── CHANGELOG.md        # Version history
├── roadmap.md          # Enhancement roadmap
├── .nojekyll           # GitHub Pages config
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions deployment
```

---

## Contributing

This project is under active development and welcomes feedback! 

- 🐛 **Report bugs** or suggest features: [GitHub Issues](https://github.com/snbyrnes/ABC-of-ECL/issues)
- 📋 **View the roadmap**: See [roadmap.md](roadmap.md) for planned enhancements

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
