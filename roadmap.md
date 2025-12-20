# ABC of ECL - Enhancement Roadmap

> **Target Audience:** Clinical informaticians  
> **Approach:** Open exploration tool  
> **Focus:** Medication data, real-world prescribing/dispensing scenarios  

---

## 1. ECL Query Anatomy Panel (Depth of Explanation)

Add an interactive breakdown panel that explains each part of the generated ECL in real-time.

### What it does
When a query is built, show a collapsible "Explain this query" section that breaks down each component (operator, concept ID, attribute, value).

### Why it helps
Informaticians learn *why* `<<` is used vs `<`, why certain attributes are selected, and how refinements chain together.

### Example
For `<< 763158003 |Medicinal product| : 127489000 |Has active ingredient| = << 387517004 |Paracetamol|`, show:

| Component | Explanation |
|-----------|-------------|
| `<<` | Includes the concept AND all descendants (subtypes) |
| `763158003` | Root concept for medicinal products in SNOMED drug model |
| `:` | Refinement operator - filters products by attribute |
| `127489000` | This attribute links a product to its active substance |
| `=` | Value constraint - the attribute must equal this value |
| `<< 387517004` | Paracetamol and all its subtypes (salts, combinations) |

### Effort
Medium

---

## 2. Clinical Scenarios Section (Real-World Use Cases)

Add a dedicated **Scenarios** page with guided, practical use cases.

### Planned Scenarios

| Scenario | ECL Focus |
|----------|-----------|
| **Dose-based prescribing** | Finding products with specific presentation strengths (e.g., "500mg tablets of paracetamol") using strength numerator/denominator attributes |
| **Prescribing → Dispensing link** | Navigating VTM → VTMP → AMP → AMPP hierarchy; showing how a prescriber's intent maps to dispensable products |
| **Substance allergy exclusion** | "Patient is allergic to penicillin - find all products to exclude" using `Has active ingredient = << 764146007 \|Penicillin\|` |
| **Therapeutic substitution** | Finding equivalent products by therapeutic class or mechanism |
| **Formulary membership** | Using `^` (member of) to query reference sets representing approved formularies |

### Scenario Structure
Each scenario would include:
1. **Clinical context** - Why this matters in practice
2. **The ECL approach** - Which operators and attributes to use
3. **Step-by-step query building** - Guided construction
4. **Interpretation of results** - What the output means clinically

### Effort
Medium-High

---

## 3. Multi-Server Support (National Applicability)

Architect the app for multiple national terminology servers.

### Features
- **Server selector** in the UI (dropdown or settings panel)
- **Server status indicator** showing connectivity and available content
- **Graceful handling** of edition differences (e.g., UK dm+d vs AU AMT vs International drug model)

### Pre-configured Endpoints

| Country | Server | Endpoint |
|---------|--------|----------|
| 🇦🇺 Australia | CSIRO Ontoserver | `https://r4.ontoserver.csiro.au/fhir` |
| 🇬🇧 UK | NHS Terminology Server | TBD |
| 🇮🇪 Ireland | HIQA NTS | TBD |
| 🇨🇦 Canada | Infoway Terminology Gateway | TBD |
| 🌍 International | SNOMED Browser API | TBD |

### Considerations
- Different national extensions have different drug models
- Some servers require authentication
- Response times and rate limits vary

### Effort
High

---

## 4. Query Comparison Tool (Deepen Understanding)

Allow users to run **two queries side-by-side** and compare results.

### Use Cases
- Compare `< 763158003` vs `<< 763158003` (with vs without self)
- Compare `<!` (children) vs `<` (all descendants)
- See overlap/difference between two ingredient queries
- Understand AND vs OR behavior

### Visual Output
- Result counts for Query A, Query B, and intersection
- Simple Venn-style indicator
- "Only in A", "Only in B", "In both" result tabs

### Learning Value
Informaticians immediately see the *practical impact* of operator choices through concrete results.

### Effort
Medium

---

## 5. ECL Playground with Live Validation (Expert Mode)

Enhance the "Custom Query" feature into a full playground for power users.

### Features

#### Syntax Highlighting
Colorize operators, concept IDs, and terms in the editor.

#### Live Syntax Validation
Catch errors before execution - show inline warnings/errors as user types.

#### Auto-complete Suggestions
- Attribute names after typing `:`
- Operators after typing `<`, `>`, `^`
- Recent/common concept IDs

#### Query History
Save and recall previous queries within a session.

#### Shareable Links
Generate URL with encoded ECL for sharing queries with colleagues.

### Effort
Medium-High

---

## Priority & Implementation Order

| Priority | Enhancement | Rationale |
|----------|-------------|-----------|
| 1 | ECL Query Anatomy | Enhances every existing template immediately |
| 2 | Clinical Scenarios | High educational value, addresses core user needs |
| 3 | Query Comparison | Deepens understanding of operators |
| 4 | ECL Playground | Power-user feature, builds on existing custom query |
| 5 | Multi-Server Support | Foundational change, requires research on endpoints |

---

## Status

- [x] ECL Query Anatomy Panel ✅ (v1.3.0 - December 2025)
- [ ] Clinical Scenarios Section
- [ ] Query Comparison Tool
- [ ] ECL Playground
- [ ] Multi-Server Support

---

*Last updated: December 2025*
