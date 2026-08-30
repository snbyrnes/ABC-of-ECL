/**
 * Query templates.
 *
 * Templates are written against the *model* description on the selected server
 * rather than against hard-coded concept IDs, so the same template produces
 * correct ECL on a dm+d-style server (Irish NMPC) and on a server that only
 * carries the international drug model.
 *
 * Every template must satisfy one rule: the ECL it generates has to do what its
 * description says it does. If a template cannot be expressed on the selected
 * model, it declares that with `models` and is hidden rather than approximated.
 */

export const CATEGORIES = [
    { key: 'scenarios',  label: 'Clinical Scenarios', icon: 'fa-user-doctor' },
    { key: 'medicines',  label: 'Medicines',          icon: 'fa-pills' },
    { key: 'basic',      label: 'Basic ECL',          icon: 'fa-code' }
];

/* ---------- helpers ---------- */

const cx = (id, term) => `${id} |${term}|`;

/** Attribute reference, optionally including its sub-attributes. */
function attr(model, key, includeSubtypes) {
    const a = model.attributes[key];
    if (!a) return null;
    return (includeSubtypes ? '<< ' : '') + cx(a.id, a.term);
}

/** The focus concept for a product query at a given level. */
function productFocus(model, levelKey) {
    if (model.levels && model.levels.length) {
        const level = model.levels.find(l => l.key === levelKey) || model.levels[1];
        return `^ ${cx(level.refset, level.name + ' reference set')}`;
    }
    return `<< ${cx('763158003', 'Medicinal product')}`;
}

function levelOptions(model) {
    return model.levels.map(l => ({ value: l.key, label: `${l.name} — ${l.label}` }));
}

function levelByKey(model, key) {
    return (model.levels || []).find(l => l.key === key) || (model.levels || [])[1] || null;
}

/** Field factory for a concept picker scoped to one of the model's hierarchies. */
function conceptField(model, { id, label, hint, picker, defaultKey, fallback }) {
    const p = model.pickers[picker] || model.pickers.anyConcept;
    const d = (defaultKey && model.defaults[defaultKey]) || fallback || { id: '138875005', term: 'SNOMED CT Concept' };
    return {
        id, label, hint,
        type: 'concept-search',
        ecl: p.ecl,
        default: d.id,
        defaultTerm: d.term
    };
}

const SUBATTR_FIELD = {
    id: 'includeSubAttributes',
    label: 'Include sub-attributes',
    hint: 'Adds << before the attribute, so sub-attributes such as "Has precise active ingredient" also match',
    type: 'checkbox',
    default: false
};

/* ---------- templates ---------- */

export const TEMPLATES = {

    /* ===== Clinical scenarios ===== */

    'prescribe-to-dispense': {
        category: 'scenarios',
        name: 'Prescribing to Dispensing',
        desc: 'Walk the product hierarchy from intent to pack',
        models: ['dmd-ie'],
        fields: model => [
            {
                id: 'level', label: 'Product level', type: 'select',
                hint: 'Each level adds detail. Prescribing usually happens near the top, dispensing at the bottom.',
                options: levelOptions(model), default: 'vmp'
            },
            conceptField(model, {
                id: 'ingredient', label: 'Active ingredient', picker: 'substance', defaultKey: 'substance',
                hint: 'Search for a substance, for example Paracetamol'
            })
        ],
        describe: (model, p) => {
            const level = levelByKey(model, p.level);
            const term = p.ingredientTerm || 'the chosen substance';
            return `Show me every <strong>${level.name}</strong> (${level.label}) containing ${term}. `
                 + `${level.blurb} `
                 + `Change the level to see how the same medicine is represented as you move from what a prescriber intends towards what a pharmacy actually hands over.`;
        },
        build: (model, p) => {
            const focus = productFocus(model, p.level);
            const a = attr(model, 'hasActiveIngredient', p.includeSubAttributes);
            const id = p.ingredient || model.defaults.substance.id;
            const term = p.ingredientTerm || model.defaults.substance.term;
            return `${focus} :\n    ${a} = << ${cx(id, term)}`;
        }
    },

    'allergy-exclusion': {
        category: 'scenarios',
        name: 'Allergy Exclusion',
        desc: 'Everything except products containing a substance',
        fields: model => [
            conceptField(model, {
                id: 'avoid', label: 'Substance to avoid', picker: 'substance', defaultKey: 'allergySubstance',
                hint: 'Search for the substance the patient reacts to, for example Penicillin'
            }),
            ...(model.levels && model.levels.length ? [{
                id: 'level', label: 'Product level', type: 'select',
                hint: 'Which level of the product hierarchy to search',
                options: levelOptions(model), default: 'vmp'
            }] : [])
        ],
        describe: (model, p) => {
            const term = p.avoidTerm || 'the chosen substance';
            return `Show me all products <strong>except</strong> those containing ${term} or any of its subtypes. `
                 + `This is the shape of query behind an allergy or contraindication check: start with everything, `
                 + `then subtract the set you must avoid. The <code>MINUS</code> operator does the subtraction.`;
        },
        build: (model, p) => {
            const focus = productFocus(model, p.level);
            const a = attr(model, 'hasActiveIngredient', p.includeSubAttributes);
            const id = p.avoid || model.defaults.allergySubstance.id;
            const term = p.avoidTerm || model.defaults.allergySubstance.term;
            return `${focus}\nMINUS\n(${focus} :\n    ${a} = << ${cx(id, term)})`;
        }
    },

    'dose-based-prescribing': {
        category: 'scenarios',
        name: 'Dose-Based Prescribing',
        desc: 'Products at a specific strength',
        models: ['dmd-ie'],
        fields: model => [
            conceptField(model, {
                id: 'ingredient', label: 'Active ingredient', picker: 'substance', defaultKey: 'substance',
                hint: 'The substance whose strength you are constraining'
            }),
            {
                id: 'strength', label: 'Strength (numerator value)', type: 'number',
                hint: 'The numeric strength, for example 500 for a 500 mg tablet',
                default: '500'
            },
            {
                id: 'level', label: 'Product level', type: 'select',
                hint: 'Strength is defined from VMP downwards',
                options: levelOptions(model).filter(o => o.value !== 'vtm' && o.value !== 'atm'),
                default: 'vmp'
            }
        ],
        describe: (model, p) => {
            const term = p.ingredientTerm || 'the chosen substance';
            return `Show me products containing ${term} at a strength of <strong>${p.strength || '500'}</strong> units. `
                 + `Strength is stored as a number, so it is matched with <code>#</code> rather than a concept. `
                 + `Note this constrains the numerator value only, not the unit, so check the results include the unit you expected.`;
        },
        build: (model, p) => {
            const focus = productFocus(model, p.level);
            const ing = attr(model, 'hasActiveIngredient', p.includeSubAttributes);
            const strength = model.attributes.strengthNumeratorValue;
            const id = p.ingredient || model.defaults.substance.id;
            const term = p.ingredientTerm || model.defaults.substance.term;
            const value = String(p.strength || '500').trim();
            return `${focus} :\n    ${ing} = << ${cx(id, term)},\n    ${cx(strength.id, strength.term)} = #${value}`;
        }
    },

    'formulary-membership': {
        category: 'scenarios',
        name: 'Reference Set Membership',
        desc: 'Products on a named list',
        models: ['dmd-ie'],
        fields: model => [{
            id: 'refset', label: 'Reference set', type: 'select',
            hint: 'Reference sets are curated lists — formularies, indicators and national subsets',
            options: [
                ...model.levels.map(l => ({ value: l.refset, label: `${l.name} reference set` })),
                ...model.namedRefsets.map(r => ({ value: r.id, label: r.term }))
            ],
            default: model.namedRefsets[0] ? model.namedRefsets[0].id : model.levels[1].refset
        }],
        describe: (model, p) => {
            const all = [
                ...model.levels.map(l => ({ id: l.refset, term: `${l.name} reference set` })),
                ...model.namedRefsets
            ];
            const chosen = all.find(r => r.id === p.refset) || all[0];
            return `Show me every concept that is a member of <strong>${chosen.term}</strong>. `
                 + `The <code>^</code> operator means "member of". Reference sets are how national release centres `
                 + `publish curated lists without changing the underlying hierarchy.`;
        },
        build: (model, p) => {
            const all = [
                ...model.levels.map(l => ({ id: l.refset, term: `${l.name} reference set` })),
                ...model.namedRefsets
            ];
            const chosen = all.find(r => r.id === p.refset) || all[0];
            return `^ ${cx(chosen.id, chosen.term)}`;
        }
    },

    /* ===== Medicines ===== */

    'products-by-ingredient': {
        category: 'medicines',
        name: 'Products by Ingredient',
        desc: 'Products containing a substance',
        fields: model => [
            conceptField(model, {
                id: 'ingredient', label: 'Active ingredient', picker: 'substance', defaultKey: 'substance',
                hint: 'Search for a substance, for example Paracetamol or Amoxicillin'
            }),
            ...(model.levels && model.levels.length ? [{
                id: 'level', label: 'Product level', type: 'select',
                hint: 'Which level of the product hierarchy to return',
                options: levelOptions(model), default: 'vmp'
            }] : []),
            SUBATTR_FIELD
        ],
        describe: (model, p) => {
            const term = p.ingredientTerm || 'the chosen substance';
            const sub = p.includeSubAttributes
                ? ` Because "include sub-attributes" is on, products recorded with a more precise ingredient attribute also match.`
                : ` Only the exact "Has active ingredient" attribute is matched. Turn on "include sub-attributes" to widen this.`;
            return `Show me products whose active ingredient is ${term}, or any subtype of it.${sub}`;
        },
        build: (model, p) => {
            const focus = productFocus(model, p.level);
            const a = attr(model, 'hasActiveIngredient', p.includeSubAttributes);
            const id = p.ingredient || model.defaults.substance.id;
            const term = p.ingredientTerm || model.defaults.substance.term;
            return `${focus} :\n    ${a} = << ${cx(id, term)}`;
        }
    },

    'products-by-dose-form': {
        category: 'medicines',
        name: 'Products by Dose Form',
        desc: 'Tablets, capsules, injections and so on',
        fields: model => [
            conceptField(model, {
                id: 'doseForm', label: 'Dose form', picker: 'doseForm', defaultKey: 'doseForm',
                hint: 'Search for a dose form, for example Oral dose form or Tablet'
            }),
            ...(model.levels && model.levels.length ? [{
                id: 'level', label: 'Product level', type: 'select',
                hint: 'Dose form is defined from VMP downwards',
                options: levelOptions(model).filter(o => o.value !== 'vtm' && o.value !== 'atm'),
                default: 'vmp'
            }] : [])
        ],
        describe: (model, p) => {
            const term = p.doseFormTerm || 'the chosen dose form';
            return `Show me products whose manufactured dose form is ${term}, or any subtype of it. `
                 + `Dose form sits below the moiety level of the hierarchy, because a substance on its own has no form.`;
        },
        build: (model, p) => {
            const focus = productFocus(model, p.level);
            const a = model.attributes.hasManufacturedDoseForm;
            const id = p.doseForm || model.defaults.doseForm.id;
            const term = p.doseFormTerm || model.defaults.doseForm.term;
            return `${focus} :\n    ${cx(a.id, a.term)} = << ${cx(id, term)}`;
        }
    },

    'product-level': {
        category: 'medicines',
        name: 'Browse a Product Level',
        desc: 'Everything at one level of the hierarchy',
        models: ['dmd-ie'],
        fields: model => [{
            id: 'level', label: 'Product level', type: 'select',
            hint: 'Each level answers a different question',
            options: levelOptions(model), default: 'vtm'
        }],
        describe: (model, p) => {
            const level = levelByKey(model, p.level);
            return `Show me every <strong>${level.name}</strong> — ${level.label}. ${level.blurb}`;
        },
        build: (model, p) => productFocus(model, p.level)
    },

    'products-by-holder': {
        category: 'medicines',
        name: 'Products by Manufacturer',
        desc: 'Products from one authorisation holder',
        models: ['dmd-ie'],
        fields: model => [
            conceptField(model, {
                id: 'holder', label: 'Marketing authorisation holder', picker: 'anyConcept',
                hint: 'Search for a company, for example Accord Healthcare Ireland Ltd',
                fallback: { id: '253961000220103', term: 'Accord Healthcare Ireland Ltd' }
            })
        ],
        describe: (model, p) => {
            const term = p.holderTerm || 'the chosen company';
            return `Show me every branded product (AMP) whose marketing authorisation is held by ${term}. `
                 + `Marketing authorisation holder is an Irish extension attribute — it does not exist in the international release.`;
        },
        build: (model, p) => {
            const focus = productFocus(model, 'amp');
            const a = model.attributes.marketingAuthHolder;
            const id = p.holder || '253961000220103';
            const term = p.holderTerm || 'Accord Healthcare Ireland Ltd';
            return `${focus} :\n    ${cx(a.id, a.term)} = ${cx(id, term)}`;
        }
    },

    'products-by-legal-status': {
        category: 'medicines',
        name: 'Products by Legal Status',
        desc: 'Prescription-only, pharmacy or general sale',
        models: ['dmd-ie'],
        fields: model => [
            conceptField(model, {
                id: 'status', label: 'Supply legal status', picker: 'supplyLegalStatus',
                hint: 'Search for a supply category, for example General Sales List',
                fallback: { id: '680751000220101', term: 'General Sales List' }
            })
        ],
        describe: (model, p) => {
            const term = p.statusTerm || 'the chosen status';
            return `Show me branded products (AMP) whose supply legal status is ${term}. `
                 + `This is the kind of query behind "what can this pharmacy sell without a prescription".`;
        },
        build: (model, p) => {
            const focus = productFocus(model, 'amp');
            const a = model.attributes.supplyLegalStatus;
            const id = p.status || '680751000220101';
            const term = p.statusTerm || 'General Sales List';
            return `${focus} :\n    ${cx(a.id, a.term)} = ${cx(id, term)}`;
        }
    },

    'packs-by-size': {
        category: 'medicines',
        name: 'Packs by Size',
        desc: 'Dispensable packs of a given count',
        models: ['dmd-ie'],
        fields: () => [{
            id: 'packSize', label: 'Pack size', type: 'number',
            hint: 'Number of units in the pack, for example 24',
            default: '24'
        }],
        describe: (model, p) =>
            `Show me every dispensable pack (AMPP) containing exactly <strong>${p.packSize || '24'}</strong> units. `
            + `Pack size is a numeric attribute, so it is matched with <code>#</code>.`,
        build: (model, p) => {
            const focus = productFocus(model, 'ampp');
            const a = model.attributes.packSize;
            return `${focus} :\n    ${cx(a.id, a.term)} = #${String(p.packSize || '24').trim()}`;
        }
    },

    /* ===== Basic ECL ===== */

    'descendants': {
        category: 'basic',
        name: 'Descendants',
        desc: 'All subtypes of a concept',
        fields: model => [
            conceptField(model, {
                id: 'concept', label: 'Parent concept', picker: 'anyConcept',
                hint: 'Search for any concept to list what sits beneath it',
                fallback: { id: '763158003', term: 'Medicinal product' }
            }),
            {
                id: 'includeSelf', label: 'Include the concept itself', type: 'checkbox',
                hint: 'Switches between << (descendants or self) and < (descendants only)',
                default: true
            }
        ],
        describe: (model, p) =>
            `Show me everything below ${p.conceptTerm || 'the chosen concept'} in the subtype hierarchy`
            + (p.includeSelf ? `, including the concept itself. Turn off "include the concept itself" and watch the count drop by exactly one.`
                             : `, excluding the concept itself. Turn the option back on and the count rises by exactly one.`),
        build: (model, p) =>
            `${p.includeSelf ? '<<' : '<'} ${cx(p.concept || '763158003', p.conceptTerm || 'Medicinal product')}`
    },

    'ancestors': {
        category: 'basic',
        name: 'Ancestors',
        desc: 'All supertypes of a concept',
        fields: model => [
            conceptField(model, {
                id: 'concept', label: 'Child concept', picker: 'anyConcept',
                hint: 'Search for any concept to list what sits above it',
                fallback: { id: '387517004', term: 'Paracetamol' }
            }),
            {
                id: 'includeSelf', label: 'Include the concept itself', type: 'checkbox',
                hint: 'Switches between >> (ancestors or self) and > (ancestors only)',
                default: false
            }
        ],
        describe: (model, p) =>
            `Show me everything above ${p.conceptTerm || 'the chosen concept'} in the subtype hierarchy. `
            + `Ancestor queries are how you find out what a concept "is a kind of".`,
        build: (model, p) =>
            `${p.includeSelf ? '>>' : '>'} ${cx(p.concept || '387517004', p.conceptTerm || 'Paracetamol')}`
    },

    'children': {
        category: 'basic',
        name: 'Direct Children',
        desc: 'One level down only',
        fields: model => [
            conceptField(model, {
                id: 'concept', label: 'Parent concept', picker: 'anyConcept',
                hint: 'Search for any concept to list its immediate children',
                fallback: { id: '763158003', term: 'Medicinal product' }
            })
        ],
        describe: (model, p) =>
            `Show me only the immediate children of ${p.conceptTerm || 'the chosen concept'} — one level down, nothing deeper. `
            + `Compare the count with the Descendants template to see how much the hierarchy fans out.`,
        build: (model, p) => `<! ${cx(p.concept || '763158003', p.conceptTerm || 'Medicinal product')}`
    },

    'member-of': {
        category: 'basic',
        name: 'Member Of',
        desc: 'Concepts in a reference set',
        fields: model => [
            conceptField(model, {
                id: 'refset', label: 'Reference set', picker: 'anyConcept',
                hint: 'Search for a reference set',
                fallback: model.levels && model.levels.length
                    ? { id: model.levels[1].refset, term: model.levels[1].name + ' reference set' }
                    : { id: '900000000000497000', term: 'CTV3 simple map reference set' }
            })
        ],
        describe: (model, p) =>
            `Show me the members of ${p.refsetTerm || 'the chosen reference set'}. `
            + `<code>^</code> reads as "member of" and ignores the hierarchy entirely — membership is curated, not inferred.`,
        build: (model, p) => `^ ${cx(p.refset || '900000000000497000', p.refsetTerm || 'Reference set')}`
    },

    'custom': {
        category: 'basic',
        name: 'Custom Query',
        desc: 'Write your own ECL',
        fields: model => [{
            id: 'customEcl', label: 'ECL expression', type: 'textarea',
            hint: 'Write any valid ECL. Errors from the server are reported below.',
            default: model.levels && model.levels.length
                ? `^ ${cx(model.levels[1].refset, 'VMP reference set')} :\n    ${cx(model.attributes.hasActiveIngredient.id, model.attributes.hasActiveIngredient.term)} = << ${cx(model.defaults.substance.id, model.defaults.substance.term)}`
                : `<< ${cx('763158003', 'Medicinal product')}`
        }],
        describe: () => 'Write your own expression constraint. The anatomy panel below breaks down whatever you type.',
        build: (model, p) => (p.customEcl && p.customEcl.trim()) || '*'
    }
};

/** Templates available on a given model, grouped by category. */
export function templatesForModel(model) {
    const groups = [];
    for (const cat of CATEGORIES) {
        const items = Object.entries(TEMPLATES)
            .filter(([, t]) => t.category === cat.key)
            .filter(([, t]) => !t.models || t.models.includes(model.id))
            .map(([id, t]) => ({ id, ...t }));
        if (items.length) groups.push({ ...cat, items });
    }
    return groups;
}

export function getTemplate(id) {
    return TEMPLATES[id] || null;
}

/** Resolve a template's field list for a model, applying defaults into params. */
export function fieldsFor(template, model) {
    return typeof template.fields === 'function' ? template.fields(model) : (template.fields || []);
}
