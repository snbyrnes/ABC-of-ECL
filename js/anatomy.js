/**
 * ECL Query Anatomy.
 *
 * Tokenises an expression constraint and explains each part. The explanations
 * are the reason this site exists, so the parser aims to be honest: anything it
 * cannot identify is shown as unrecognised rather than quietly dropped.
 */

export const OPERATORS = {
    '<<': {
        name: 'Descendant or self of', icon: 'fa-sitemap',
        explanation: 'Matches the concept itself and every concept beneath it in the subtype hierarchy.',
        tip: 'The workhorse of ECL. Use it when a more specific concept should still count as a match.'
    },
    '<': {
        name: 'Descendant of', icon: 'fa-arrow-down-wide-short',
        explanation: 'Matches every concept beneath this one, but not the concept itself.',
        tip: 'Differs from << by exactly one concept. Run both and compare the counts.'
    },
    '>>': {
        name: 'Ancestor or self of', icon: 'fa-arrow-up-wide-short',
        explanation: 'Matches the concept itself and every concept above it in the subtype hierarchy.'
    },
    '>': {
        name: 'Ancestor of', icon: 'fa-arrow-up',
        explanation: 'Matches every concept above this one, answering "what is this a kind of?".'
    },
    '<!': {
        name: 'Child of', icon: 'fa-turn-down',
        explanation: 'Matches only the immediate children — one level down, nothing deeper.',
        tip: 'Useful for walking a hierarchy a level at a time instead of pulling thousands of descendants.'
    },
    '>!': {
        name: 'Parent of', icon: 'fa-turn-up',
        explanation: 'Matches only the immediate parents — one level up, nothing higher.'
    },
    '^': {
        name: 'Member of', icon: 'fa-layer-group',
        explanation: 'Matches the members of a reference set. Membership is curated by a release centre, not inferred from the hierarchy.',
        tip: 'This is how formularies and national subsets are published without altering SNOMED itself.'
    },
    '*': {
        name: 'Any concept', icon: 'fa-asterisk',
        explanation: 'Wildcard. On its own it means every concept; as an attribute value it means "has this attribute at all".'
    },
    ':': {
        name: 'Refinement', icon: 'fa-filter',
        explanation: 'Everything after the colon narrows the set to concepts whose attributes match.'
    },
    '=': {
        name: 'Equals', icon: 'fa-equals',
        explanation: 'The attribute must have this value.'
    },
    '!=': {
        name: 'Not equals', icon: 'fa-not-equal',
        explanation: 'The attribute must not have this value.'
    },
    ',': {
        name: 'And (within refinement)', icon: 'fa-plus',
        explanation: 'A comma between attributes means all of them must match.'
    },
    'AND': {
        name: 'Conjunction', icon: 'fa-object-group',
        explanation: 'A concept must satisfy both sides to match. The result is the intersection of the two sets.'
    },
    'OR': {
        name: 'Disjunction', icon: 'fa-object-ungroup',
        explanation: 'A concept matches if it satisfies either side. The result is the union of the two sets.'
    },
    'MINUS': {
        name: 'Exclusion', icon: 'fa-circle-minus',
        explanation: 'Removes everything in the right-hand set from the left-hand set.',
        tip: 'The basis of allergy and contraindication queries: take everything, then subtract what must be avoided.'
    }
};

/** Concepts worth a note beyond their term. Extended at runtime from the model. */
const BASE_CONCEPTS = {
    '138875005': { name: 'SNOMED CT Concept', category: 'Hierarchy root',
        explanation: 'The single root of the whole terminology. Every concept descends from it.' },
    '763158003': { name: 'Medicinal product', category: 'Drug model root',
        explanation: 'The top of the medicinal product hierarchy in the international release.' },
    '373873005': { name: 'Pharmaceutical / biologic product', category: 'Drug model root',
        explanation: 'Sits above both medicinal products and product packages.' },
    '781405001': { name: 'Medicinal product package', category: 'Drug model root',
        explanation: 'Products as packaged, rather than the abstract product.' },
    '105590001': { name: 'Substance', category: 'Hierarchy root',
        explanation: 'The substance hierarchy. Ingredients are substances, not products.' },
    '404684003': { name: 'Clinical finding', category: 'Hierarchy root',
        explanation: 'Diseases, symptoms and observations. Disorders are the subset that are always abnormal.' },
    '71388002':  { name: 'Procedure', category: 'Hierarchy root',
        explanation: 'Interventions and investigations.' },
    '91723000':  { name: 'Anatomical structure', category: 'Hierarchy root',
        explanation: 'Body structures used as finding sites and procedure sites.' },
    '736542009': { name: 'Pharmaceutical dose form', category: 'Hierarchy root',
        explanation: 'The form a product takes — tablet, capsule, solution and so on.' },
    '127489000': { name: 'Has active ingredient', category: 'Drug attribute', isAttribute: true,
        explanation: 'Links a product to the substance that gives it its effect.',
        tip: 'It has a sub-attribute, "Has precise active ingredient". Prefixing with << includes both.' },
    '762949000': { name: 'Has precise active ingredient', category: 'Drug attribute', isAttribute: true,
        explanation: 'A more exact form of the ingredient link, naming the precise substance such as a specific salt.' },
    '411116001': { name: 'Has manufactured dose form', category: 'Drug attribute', isAttribute: true,
        explanation: 'The dose form as manufactured. Renamed from "Has dose form" — the older term still circulates.' },
    '1142135004':{ name: 'Has presentation strength numerator value', category: 'Drug attribute', isAttribute: true,
        explanation: 'The numeric part of a strength, matched with # rather than a concept.' },
    '732945000': { name: 'Has presentation strength numerator unit', category: 'Drug attribute', isAttribute: true,
        explanation: 'The unit that goes with the strength numerator.' },
    '1142142004':{ name: 'Has pack size', category: 'Drug attribute', isAttribute: true,
        explanation: 'How many units are in a pack. Numeric, so matched with #.' },
    '774160008': { name: 'Contains clinical drug', category: 'Drug attribute', isAttribute: true,
        explanation: 'Links a pack to the product inside it.' },
    '774158006': { name: 'Has product name', category: 'Drug attribute', isAttribute: true,
        explanation: 'Links a product to its brand name concept.' },
    '363698007': { name: 'Finding site', category: 'Clinical attribute', isAttribute: true,
        explanation: 'The body structure a finding is about.' },
    '116676008': { name: 'Associated morphology', category: 'Clinical attribute', isAttribute: true,
        explanation: 'The structural change involved — inflammation, oedema, neoplasm and so on.' },
    '246075003': { name: 'Causative agent', category: 'Clinical attribute', isAttribute: true,
        explanation: 'What caused the finding: an organism, a substance or a physical force.' },
    '363704007': { name: 'Procedure site', category: 'Procedure attribute', isAttribute: true,
        explanation: 'The body structure a procedure is performed on.' },
    '387517004': { name: 'Paracetamol', category: 'Substance',
        explanation: 'A substance concept. Note this is the substance, not the product — products reference it via an ingredient attribute.' },
    '764146007': { name: 'Penicillin', category: 'Substance',
        explanation: 'A substance grouper. Using << here catches the whole penicillin family, which is what an allergy check needs.' }
};

/** Build a concept dictionary that also knows the selected server's model. */
export function buildConceptIndex(model) {
    const index = { ...BASE_CONCEPTS };
    for (const level of model.levels || []) {
        index[level.refset] = {
            name: `${level.name} reference set`,
            category: 'Product reference set',
            explanation: `${level.label}. ${level.blurb}`
        };
    }
    for (const [, a] of Object.entries(model.attributes || {})) {
        if (!index[a.id]) {
            index[a.id] = {
                name: a.term, category: 'Attribute', isAttribute: true,
                explanation: `Links a concept to its ${a.term.replace(/^Has /i, '').toLowerCase()}.`
            };
        }
    }
    for (const r of model.namedRefsets || []) {
        if (!index[r.id]) {
            index[r.id] = {
                name: r.term, category: 'Reference set',
                explanation: 'A curated list published as a reference set.'
            };
        }
    }
    return index;
}

/* ---------- tokeniser ---------- */

const PATTERNS = [
    { type: 'whitespace', re: /^\s+/, skip: true },
    { type: 'operator',   re: /^(MINUS|AND|OR)\b/ },
    { type: 'operator',   re: /^(<<|>>|<!|>!|!=|<|>|\^|:|=|,)/ },
    { type: 'wildcard',   re: /^\*/ },
    { type: 'number',     re: /^#(-?\d+(?:\.\d+)?)/ },
    { type: 'string',     re: /^"((?:[^"\\]|\\.)*)"/ },
    { type: 'concept',    re: /^(\d{6,18})\s*\|([^|]*)\|/ },
    { type: 'concept',    re: /^(\d{6,18})/ },
    { type: 'grouping',   re: /^[()]/ }
];

export function tokenise(ecl) {
    const tokens = [];
    const source = String(ecl || '');
    let rest = source;
    let offset = 0;   // byte position in `source`, so callers can highlight in place

    while (rest.length) {
        let matched = false;
        for (const p of PATTERNS) {
            const m = rest.match(p.re);
            if (!m) continue;
            if (!p.skip) {
                tokens.push({
                    type: p.type,
                    raw: m[0],
                    value: m[1] !== undefined ? m[1] : m[0],
                    term: m[2] !== undefined ? m[2].trim() : null,
                    start: offset,
                    end: offset + m[0].length
                });
            }
            rest = rest.slice(m[0].length);
            offset += m[0].length;
            matched = true;
            break;
        }
        if (!matched) {
            // Keep unrecognised input visible instead of silently discarding it.
            const chunk = rest.match(/^\S+/)[0];
            tokens.push({
                type: 'unknown', raw: chunk, value: chunk, term: null,
                start: offset, end: offset + chunk.length
            });
            rest = rest.slice(chunk.length);
            offset += chunk.length;
        }
    }
    return tokens;
}

/**
 * Annotate tokens with their role, tracking whether we are reading the focus
 * concept, an attribute name, or an attribute value.
 */
export function annotate(tokens) {
    let context = 'focus';
    let depth = 0;

    return tokens.map(t => {
        const out = { ...t, role: null };

        if (t.type === 'grouping') {
            depth += t.raw === '(' ? 1 : -1;
            return out;
        }
        if (t.type === 'operator') {
            if (t.value === ':') { context = 'attribute'; }
            else if (t.value === '=' || t.value === '!=') { context = 'value'; }
            else if (t.value === ',') { context = 'attribute'; }
            else if (['AND', 'OR', 'MINUS'].includes(t.value)) { context = 'focus'; }
            return out;
        }
        if (t.type === 'concept') {
            out.role = context === 'attribute' ? 'attribute'
                     : context === 'value' ? 'value'
                     : 'focus';
            if (context === 'value') context = 'attribute';
            return out;
        }
        if (t.type === 'number' || t.type === 'string' || t.type === 'wildcard') {
            out.role = context === 'value' ? 'value' : 'focus';
            if (context === 'value') context = 'attribute';
            return out;
        }
        return out;
    });
}

/**
 * Produce the structured explanation list the UI renders.
 * Returns [{ kind, label, code, explanation, tip, icon }].
 */
export function explain(ecl, conceptIndex) {
    const tokens = annotate(tokenise(ecl));
    const parts = [];

    for (const t of tokens) {
        if (t.type === 'grouping') continue;

        if (t.type === 'operator') {
            const info = OPERATORS[t.value];
            if (!info) continue;
            // Commas and equals are structural; showing a card for each is noise.
            if (t.value === '=' || t.value === ',') continue;
            parts.push({
                kind: 'operator', icon: info.icon, label: info.name,
                code: t.raw, explanation: info.explanation, tip: info.tip || null
            });
            continue;
        }

        if (t.type === 'concept') {
            const info = conceptIndex[t.value] || null;
            const term = t.term || (info ? info.name : 'Concept');
            parts.push({
                kind: t.role || 'focus',
                icon: t.role === 'attribute' ? 'fa-link' : 'fa-cube',
                label: (info ? info.category : 'Concept') + (t.role === 'attribute' ? ' (attribute)' : ''),
                code: `${t.value} |${term}|`,
                explanation: info ? info.explanation : `SNOMED CT concept "${term}".`,
                tip: info ? info.tip || null : null,
                warning: t.term && info && info.name && !termsAgree(t.term, info.name)
                    ? `This site knows ${t.value} as "${info.name}". The term written here differs; terms in ECL are advisory, but a mismatch usually means the ID or the term is stale.`
                    : null
            });
            continue;
        }

        if (t.type === 'number') {
            parts.push({
                kind: 'value', icon: 'fa-hashtag', label: 'Numeric value', code: t.raw,
                explanation: `Matches the number ${t.value}. Numeric attributes such as strength and pack size use # instead of a concept.`
            });
            continue;
        }

        if (t.type === 'string') {
            parts.push({
                kind: 'value', icon: 'fa-quote-left', label: 'Text value', code: t.raw,
                explanation: 'Matches a literal string value, used by attributes that hold text rather than a concept.'
            });
            continue;
        }

        if (t.type === 'wildcard') {
            const info = OPERATORS['*'];
            parts.push({
                kind: 'operator', icon: info.icon, label: info.name,
                code: '*', explanation: info.explanation
            });
            continue;
        }

        if (t.type === 'unknown') {
            parts.push({
                kind: 'unknown', icon: 'fa-triangle-exclamation', label: 'Not recognised',
                code: t.raw,
                explanation: 'This part of the expression could not be identified. It may be a syntax error, or syntax this breakdown does not cover yet.'
            });
        }
    }

    return parts;
}

/** Loose comparison so "Oedema"/"Edema" and case differences do not raise a warning. */
function termsAgree(a, b) {
    const norm = s => String(s).toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/oe/g, 'e')
        .replace(/[^a-z0-9]/g, '');
    const x = norm(a), y = norm(b);
    return x === y || x.includes(y) || y.includes(x);
}
