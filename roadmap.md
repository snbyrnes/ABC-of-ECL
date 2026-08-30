# Roadmap

What is built, and what is being considered next. Suggestions and requests are
welcome — open an [issue](https://github.com/snbyrnes/ABC-of-ECL/issues).

---

## Built

| Feature | Released |
|---|---|
| Interactive query builder with plain-English descriptions | 1.0 |
| ECL query anatomy — every operator and concept explained | 1.3, extended in 2.0 |
| Clinical scenario templates | 2.0 |
| Query comparison — two expressions side by side | 2.0 |
| Shareable query links | 2.0 |
| FHIR server registry with per-server drug models | 2.0 |
| ECL editor — highlighting, validation, autocomplete | 2.0 |
| Export as a FHIR ValueSet | 2.0 |
| Self-hosted fonts and icons; no third-party requests | 2.0 |

---

## Under consideration

Nothing here is committed to a date. Items move up when there is a clear use for
them, so if one of these would help you, saying so is the most useful thing you
can do.

### Wider access

The site currently requires credentials for the configured server. Supporting a
server that needs no sign-in would let anyone explore ECL without an account —
including learners in countries without a SNOMED CT affiliate licence, for whom
the licence-free Global Patient Set is the relevant content.

### Comparison across editions

National editions answer the same expression very differently, because their drug
models differ. Running one expression against several editions and showing the
differences would make that concrete rather than theoretical.

### Comparison across releases

SNOMED CT publishes twice a year and concepts are added and inactivated between
releases. Running the same expression against two versions of one edition would
answer "what changed, and does it affect my value set?" without diffing release
files by hand.

### A page per operator and scenario

Today the reference lives inside a handful of pages. Giving each operator and each
clinical scenario its own page, with a runnable query, would make the answers
findable from a search engine rather than only from the site's own navigation.

### Editor improvements

The ECL editor highlights syntax, validates advisory rules and completes attribute
names. Still possible: highlighting the exact span a diagnostic refers to, and
inline concept search while typing.

### ValueSet import

Export exists. Import would close the loop — paste a ValueSet, read the ECL out of
its compose rule, and explain it operator by operator. That makes the site useful
for expressions you did not write yourself.

### Authentication without a client secret

The configured server's identity provider supports the authorization code flow
with PKCE, which needs no secret. Adopting it depends on a public client being
registered for this site; the auth module is written so a second grant type can
sit alongside the existing one.

---

## Ideas

Smaller things that have been suggested or considered:

- **Hierarchy walker** — click through parents and children without writing ECL each time
- **Attribute discovery** — show which attributes are actually populated on a concept
- **Saved queries** — history currently lasts one browser session
- **More national servers** — the registry supports it; each needs endpoint details and a description of its drug model

---

*Last updated: 30 August 2026*
