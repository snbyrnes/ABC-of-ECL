/**
 * ABC of ECL - ECL Query Builder Application
 * An interactive learning tool for SNOMED CT Expression Constraint Language
 */

// ===== Configuration =====
const CONFIG = {
    fhirServer: 'https://r4.ontoserver.csiro.au/fhir',
    defaultLimit: 100,
    searchDebounce: 300,
    minSearchLength: 3
};

// ===== SNOMED CT Concept IDs =====
const CONCEPTS = {
    // Root concepts
    snomedConcept: '138875005',
    
    // Medicines
    medicinalProduct: '763158003',
    clinicalDrug: '763158003',
    pharmaceuticalProduct: '373873005',
    
    // Attributes
    hasActiveIngredient: '127489000',
    hasDoseForm: '411116001',
    hasManufacturedDoseForm: '411116001',
    hasPresentationStrengthNumerator: '1142135004',
    hasPresentationStrengthUnit: '732945000',
    
    // Dose Forms
    oralDoseForm: '385268001',
    injectionDoseForm: '385219001',
    tabletDoseForm: '385055001',
    capsuleDoseForm: '385049006',
    
    // Clinical
    clinicalFinding: '404684003',
    disorder: '64572001',
    procedure: '71388002',
    
    // Attributes for clinical
    findingSite: '363698007',
    associatedMorphology: '116676008',
    causativeAgent: '246075003',
    
    // Body structures
    anatomicalStructure: '91723000',
    
    // Example substances
    paracetamol: '387517004',
    amoxicillin: '372687004',
    ibuprofen: '387207008',
    
    // Example conditions
    diabetesMellitus: '73211009',
    disorderOfLung: '19829001',
    edema: '79654002',
    stenosis: '415582006'
};

// ===== Query Templates =====
const QUERY_TEMPLATES = {
    'medicinal-products': {
        description: 'Show me all medicinal products in the terminology. This includes clinical drugs, pharmaceutical products, and other medicine-related concepts.',
        buildQuery: () => `<< ${CONCEPTS.medicinalProduct} |Medicinal product|`,
        form: []
    },
    
    'products-by-ingredient': {
        description: 'Show me all medicinal products that contain a specific active ingredient. Select or search for the substance you\'re interested in.',
        buildQuery: (params) => {
            const conceptId = params.ingredient || CONCEPTS.paracetamol;
            const term = params.ingredientTerm || 'Paracetamol';
            return `<< ${CONCEPTS.medicinalProduct} |Medicinal product| :
    << ${CONCEPTS.hasActiveIngredient} |Has active ingredient| = << ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'ingredient',
                label: 'Active Ingredient',
                hint: 'Search for a substance (e.g., Paracetamol, Amoxicillin)',
                type: 'concept-search',
                ecl: `<< 105590001 |Substance|`,
                default: CONCEPTS.paracetamol,
                defaultTerm: 'Paracetamol'
            }
        ]
    },
    
    'products-by-dose-form': {
        description: 'Show me all medicinal products that have a specific dose form, such as tablets, capsules, injections, or oral solutions.',
        buildQuery: (params) => {
            const conceptId = params.doseForm || CONCEPTS.tabletDoseForm;
            const term = params.doseFormTerm || 'Tablet';
            return `<< ${CONCEPTS.medicinalProduct} |Medicinal product| :
    ${CONCEPTS.hasDoseForm} |Has manufactured dose form| = << ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'doseForm',
                label: 'Dose Form',
                hint: 'Search for a dose form (e.g., Tablet, Capsule, Injection)',
                type: 'concept-search',
                ecl: `<< 736542009 |Pharmaceutical dose form|`,
                default: CONCEPTS.tabletDoseForm,
                defaultTerm: 'Tablet dose form'
            }
        ]
    },
    
    'vtm-products': {
        description: 'Show me all products (VTMPs, AMPs, packaged drugs) that are related to a particular Virtual Therapeutic Moiety (VTM). VTMs represent the core substance without specifying strength or dose form.',
        buildQuery: (params) => {
            const conceptId = params.vtm || CONCEPTS.paracetamol;
            const term = params.vtmTerm || 'Paracetamol';
            return `<< ${CONCEPTS.medicinalProduct} |Medicinal product| :
    << ${CONCEPTS.hasActiveIngredient} |Has active ingredient| = << ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'vtm',
                label: 'Virtual Therapeutic Moiety (Substance)',
                hint: 'Search for a VTM or substance (e.g., Paracetamol, Metformin)',
                type: 'concept-search',
                ecl: `<< 105590001 |Substance|`,
                default: CONCEPTS.paracetamol,
                defaultTerm: 'Paracetamol'
            }
        ]
    },
    
    'packaged-drugs': {
        description: 'Show me all packaged clinical drug products. These are the actual products as dispensed, with packaging information.',
        buildQuery: () => `<< 763158003 |Medicinal product| :
    << ${CONCEPTS.hasActiveIngredient} |Has active ingredient| = *`,
        form: []
    },
    
    'oral-medications': {
        description: 'Show me all medicinal products that come in oral dose forms, including tablets, capsules, oral solutions, and other forms taken by mouth.',
        buildQuery: () => `<< ${CONCEPTS.medicinalProduct} |Medicinal product| :
    ${CONCEPTS.hasDoseForm} |Has manufactured dose form| = << ${CONCEPTS.oralDoseForm} |Oral dose form|`,
        form: []
    },
    
    'disorders': {
        description: 'Show me all clinical findings/disorders matching your search. This includes diseases, syndromes, and other clinical conditions.',
        buildQuery: (params) => {
            const conceptId = params.disorder || CONCEPTS.clinicalFinding;
            const term = params.disorderTerm || 'Clinical finding';
            return `<< ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'disorder',
                label: 'Clinical Finding/Disorder',
                hint: 'Search for a disorder (e.g., Diabetes, Pneumonia)',
                type: 'concept-search',
                ecl: `<< ${CONCEPTS.clinicalFinding} |Clinical finding|`,
                default: CONCEPTS.diabetesMellitus,
                defaultTerm: 'Diabetes mellitus'
            }
        ]
    },
    
    'findings-by-site': {
        description: 'Show me all clinical findings that affect a specific body site or anatomical structure.',
        buildQuery: (params) => {
            const conceptId = params.bodySite || '39607008';
            const term = params.bodySiteTerm || 'Lung structure';
            return `< ${CONCEPTS.clinicalFinding} |Clinical finding| :
    ${CONCEPTS.findingSite} |Finding site| = << ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'bodySite',
                label: 'Body Site',
                hint: 'Search for a body structure (e.g., Lung, Heart, Kidney)',
                type: 'concept-search',
                ecl: `<< ${CONCEPTS.anatomicalStructure} |Anatomical structure|`,
                default: '39607008',
                defaultTerm: 'Lung structure'
            }
        ]
    },
    
    'findings-by-morphology': {
        description: 'Show me all clinical findings that have a specific morphology, such as inflammation, neoplasm, or edema.',
        buildQuery: (params) => {
            const conceptId = params.morphology || CONCEPTS.edema;
            const term = params.morphologyTerm || 'Edema';
            return `< ${CONCEPTS.clinicalFinding} |Clinical finding| :
    ${CONCEPTS.associatedMorphology} |Associated morphology| = << ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'morphology',
                label: 'Morphology',
                hint: 'Search for a morphology (e.g., Edema, Inflammation, Neoplasm)',
                type: 'concept-search',
                ecl: `<< 49755003 |Morphologically abnormal structure|`,
                default: CONCEPTS.edema,
                defaultTerm: 'Edema'
            }
        ]
    },
    
    'procedures': {
        description: 'Show me all procedures in the terminology. This includes surgical procedures, diagnostic procedures, and other clinical interventions.',
        buildQuery: () => `<< ${CONCEPTS.procedure} |Procedure|`,
        form: []
    },
    
    'procedures-by-site': {
        description: 'Show me all procedures that are performed on a specific body site or anatomical structure.',
        buildQuery: (params) => {
            const conceptId = params.procedureSite || '39607008';
            const term = params.procedureSiteTerm || 'Lung structure';
            return `< ${CONCEPTS.procedure} |Procedure| :
    363704007 |Procedure site| = << ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'procedureSite',
                label: 'Procedure Site',
                hint: 'Search for a body structure (e.g., Heart, Knee, Eye)',
                type: 'concept-search',
                ecl: `<< ${CONCEPTS.anatomicalStructure} |Anatomical structure|`,
                default: '39607008',
                defaultTerm: 'Lung structure'
            }
        ]
    },
    
    'descendants': {
        description: 'Show me all descendants (subtypes) of a concept. This uses the < operator to find all concepts that are more specific than the given concept.',
        buildQuery: (params) => {
            const conceptId = params.concept || CONCEPTS.medicinalProduct;
            const term = params.conceptTerm || 'Medicinal product';
            return `< ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'concept',
                label: 'Parent Concept',
                hint: 'Search for any concept to find its descendants',
                type: 'concept-search',
                ecl: `*`,
                default: CONCEPTS.medicinalProduct,
                defaultTerm: 'Medicinal product'
            }
        ]
    },
    
    'ancestors': {
        description: 'Show me all ancestors (supertypes) of a concept. This uses the > operator to find all concepts that are more general than the given concept.',
        buildQuery: (params) => {
            const conceptId = params.concept || CONCEPTS.paracetamol;
            const term = params.conceptTerm || 'Paracetamol';
            return `> ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'concept',
                label: 'Child Concept',
                hint: 'Search for any concept to find its ancestors',
                type: 'concept-search',
                ecl: `*`,
                default: CONCEPTS.paracetamol,
                defaultTerm: 'Paracetamol'
            }
        ]
    },
    
    'children': {
        description: 'Show me only the direct children (immediate subtypes) of a concept. This uses the <! operator to find only the first level of children.',
        buildQuery: (params) => {
            const conceptId = params.concept || CONCEPTS.medicinalProduct;
            const term = params.conceptTerm || 'Medicinal product';
            return `<! ${conceptId} |${term}|`;
        },
        form: [
            {
                id: 'concept',
                label: 'Parent Concept',
                hint: 'Search for any concept to find its direct children',
                type: 'concept-search',
                ecl: `*`,
                default: CONCEPTS.medicinalProduct,
                defaultTerm: 'Medicinal product'
            }
        ]
    },
    
    'custom': {
        description: 'Write your own custom ECL query. You have full control over the expression constraint syntax.',
        buildQuery: (params) => params.customEcl || '*',
        form: [
            {
                id: 'customEcl',
                label: 'ECL Expression',
                hint: 'Enter your custom ECL query',
                type: 'textarea',
                default: '<< 763158003 |Medicinal product|'
            }
        ]
    }
};

// ===== Example Queries =====
const EXAMPLE_QUERIES = {
    'paracetamol': {
        template: 'products-by-ingredient',
        params: { ingredient: CONCEPTS.paracetamol, ingredientTerm: 'Paracetamol' }
    },
    'amoxicillin': {
        template: 'products-by-dose-form',
        ecl: `< ${CONCEPTS.medicinalProduct} |Medicinal product| :
    ${CONCEPTS.hasDoseForm} |Has manufactured dose form| = << ${CONCEPTS.oralDoseForm} |Oral dose form|,
    << ${CONCEPTS.hasActiveIngredient} |Has active ingredient| = << ${CONCEPTS.amoxicillin} |Amoxicillin|`
    },
    'diabetes': {
        template: 'disorders',
        params: { disorder: CONCEPTS.diabetesMellitus, disorderTerm: 'Diabetes mellitus' }
    },
    'lung-edema': {
        template: 'findings-by-morphology',
        ecl: `< ${CONCEPTS.disorderOfLung} |Disorder of lung| :
    ${CONCEPTS.associatedMorphology} |Associated morphology| = << ${CONCEPTS.edema} |Edema|`
    },
    'injectable': {
        template: 'products-by-dose-form',
        params: { doseForm: CONCEPTS.injectionDoseForm, doseFormTerm: 'Injection dose form' }
    },
    'causative': {
        template: 'custom',
        params: { customEcl: `*: ${CONCEPTS.causativeAgent} |Causative agent| = ${CONCEPTS.paracetamol} |Paracetamol|` }
    }
};

// ===== Application State =====
let state = {
    currentTemplate: null,
    formParams: {},
    currentEcl: '',
    searchTimeout: null
};

// ===== DOM Elements =====
const elements = {
    themeToggle: document.getElementById('themeToggle'),
    mobileMenu: document.getElementById('mobileMenu'),
    builderForm: document.getElementById('builderForm'),
    queryDescription: document.getElementById('queryDescription'),
    eclOutput: document.getElementById('eclOutput'),
    executeQuery: document.getElementById('executeQuery'),
    clearQuery: document.getElementById('clearQuery'),
    copyEcl: document.getElementById('copyEcl'),
    resultsContainer: document.getElementById('resultsContainer'),
    resultCount: document.getElementById('resultCount'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// ===== Theme Management =====
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ===== Toast Notifications =====
function showToast(message, duration = 3000) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('active');
    setTimeout(() => {
        elements.toast.classList.remove('active');
    }, duration);
}

// ===== Loading State =====
function showLoading() {
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

// ===== FHIR API Functions =====
async function expandValueSet(ecl, offset = 0, count = CONFIG.defaultLimit) {
    const url = new URL(`${CONFIG.fhirServer}/ValueSet/$expand`);
    url.searchParams.set('url', `http://snomed.info/sct?fhir_vs=ecl/${encodeURIComponent(ecl)}`);
    url.searchParams.set('count', count);
    url.searchParams.set('offset', offset);
    url.searchParams.set('displayLanguage', 'en');
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/fhir+json'
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
}

async function searchConcepts(term, ecl = '*') {
    const url = new URL(`${CONFIG.fhirServer}/ValueSet/$expand`);
    url.searchParams.set('url', `http://snomed.info/sct?fhir_vs=ecl/${encodeURIComponent(ecl)}`);
    url.searchParams.set('filter', term);
    url.searchParams.set('count', 20);
    url.searchParams.set('displayLanguage', 'en');
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/fhir+json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
    }
    
    return await response.json();
}

// ===== ECL Formatting =====
function formatEcl(ecl) {
    // Return clean ECL - just escape HTML entities for safe display
    return ecl
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ===== Template Selection =====
function selectTemplate(templateId) {
    // Remove active class from all buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to selected button
    const selectedBtn = document.querySelector(`[data-template="${templateId}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    state.currentTemplate = templateId;
    state.formParams = {};
    
    const template = QUERY_TEMPLATES[templateId];
    if (!template) return;
    
    // Update description
    elements.queryDescription.innerHTML = `<p>${template.description}</p>`;
    
    // Build form
    buildForm(template.form);
    
    // Generate initial ECL
    generateEcl();
}

// ===== Form Building =====
function buildForm(formFields) {
    if (!formFields || formFields.length === 0) {
        elements.builderForm.innerHTML = `
            <div class="form-placeholder">
                <i class="fas fa-check-circle"></i>
                <p>No additional parameters needed. Click "Execute Query" to run.</p>
            </div>
        `;
        return;
    }
    
    let formHtml = '';
    
    formFields.forEach(field => {
        if (field.type === 'concept-search') {
            // Set default value in state
            state.formParams[field.id] = field.default;
            state.formParams[`${field.id}Term`] = field.defaultTerm;
            
            formHtml += `
                <div class="form-group">
                    <label for="${field.id}">
                        ${field.label}
                        <span class="label-hint">${field.hint}</span>
                    </label>
                    <div class="concept-search">
                        <input type="text" 
                               id="${field.id}" 
                               class="form-control concept-search-input" 
                               data-ecl="${field.ecl}"
                               data-field-id="${field.id}"
                               placeholder="Type to search..."
                               value="${field.defaultTerm || ''}"
                               autocomplete="off">
                        <div class="concept-suggestions" id="${field.id}-suggestions"></div>
                    </div>
                    <input type="hidden" id="${field.id}-value" value="${field.default || ''}">
                </div>
            `;
        } else if (field.type === 'select') {
            state.formParams[field.id] = field.default || field.options[0].value;
            
            formHtml += `
                <div class="form-group">
                    <label for="${field.id}">
                        ${field.label}
                        <span class="label-hint">${field.hint}</span>
                    </label>
                    <select id="${field.id}" class="form-control" data-field-id="${field.id}">
                        ${field.options.map(opt => 
                            `<option value="${opt.value}" ${opt.value === field.default ? 'selected' : ''}>${opt.label}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        } else if (field.type === 'textarea') {
            state.formParams[field.id] = field.default || '';
            
            formHtml += `
                <div class="form-group">
                    <label for="${field.id}">
                        ${field.label}
                        <span class="label-hint">${field.hint}</span>
                    </label>
                    <textarea id="${field.id}" 
                              class="form-control" 
                              data-field-id="${field.id}"
                              rows="5"
                              placeholder="Enter ECL expression...">${field.default || ''}</textarea>
                </div>
            `;
        } else {
            state.formParams[field.id] = field.default || '';
            
            formHtml += `
                <div class="form-group">
                    <label for="${field.id}">
                        ${field.label}
                        <span class="label-hint">${field.hint}</span>
                    </label>
                    <input type="text" 
                           id="${field.id}" 
                           class="form-control"
                           data-field-id="${field.id}"
                           placeholder="${field.hint}"
                           value="${field.default || ''}">
                </div>
            `;
        }
    });
    
    elements.builderForm.innerHTML = formHtml;
    
    // Attach event listeners
    attachFormListeners();
}

function attachFormListeners() {
    // Concept search inputs
    document.querySelectorAll('.concept-search-input').forEach(input => {
        input.addEventListener('input', handleConceptSearch);
        input.addEventListener('focus', () => {
            const suggestionsEl = document.getElementById(`${input.dataset.fieldId}-suggestions`);
            if (suggestionsEl.children.length > 0) {
                suggestionsEl.classList.add('active');
            }
        });
        input.addEventListener('blur', (e) => {
            // Delay to allow click on suggestion
            setTimeout(() => {
                const suggestionsEl = document.getElementById(`${input.dataset.fieldId}-suggestions`);
                suggestionsEl.classList.remove('active');
            }, 200);
        });
    });
    
    // Select inputs
    document.querySelectorAll('select.form-control').forEach(select => {
        select.addEventListener('change', (e) => {
            state.formParams[e.target.dataset.fieldId] = e.target.value;
            generateEcl();
        });
    });
    
    // Text inputs and textareas
    document.querySelectorAll('input.form-control:not(.concept-search-input), textarea.form-control').forEach(input => {
        input.addEventListener('input', (e) => {
            state.formParams[e.target.dataset.fieldId] = e.target.value;
            generateEcl();
        });
    });
}

async function handleConceptSearch(e) {
    const input = e.target;
    const fieldId = input.dataset.fieldId;
    const ecl = input.dataset.ecl;
    const term = input.value.trim();
    const suggestionsEl = document.getElementById(`${fieldId}-suggestions`);
    
    // Clear previous timeout
    if (state.searchTimeout) {
        clearTimeout(state.searchTimeout);
    }
    
    if (term.length < CONFIG.minSearchLength) {
        suggestionsEl.classList.remove('active');
        return;
    }
    
    suggestionsEl.innerHTML = '<div class="suggestion-loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    suggestionsEl.classList.add('active');
    
    // Debounce the search
    state.searchTimeout = setTimeout(async () => {
        try {
            const results = await searchConcepts(term, ecl);
            displaySuggestions(results, fieldId, suggestionsEl);
        } catch (error) {
            console.error('Search error:', error);
            suggestionsEl.innerHTML = '<div class="suggestion-loading">Search failed. Please try again.</div>';
        }
    }, CONFIG.searchDebounce);
}

function displaySuggestions(results, fieldId, suggestionsEl) {
    if (!results.expansion || !results.expansion.contains || results.expansion.contains.length === 0) {
        suggestionsEl.innerHTML = '<div class="suggestion-loading">No results found</div>';
        return;
    }
    
    const concepts = results.expansion.contains;
    let html = '';
    
    concepts.forEach(concept => {
        html += `
            <div class="suggestion-item" 
                 data-code="${concept.code}" 
                 data-display="${concept.display}"
                 data-field-id="${fieldId}">
                <div class="concept-id">${concept.code}</div>
                <div class="concept-term">${concept.display}</div>
            </div>
        `;
    });
    
    suggestionsEl.innerHTML = html;
    
    // Attach click handlers
    suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', selectSuggestion);
    });
}

function selectSuggestion(e) {
    const item = e.currentTarget;
    const fieldId = item.dataset.fieldId;
    const code = item.dataset.code;
    const display = item.dataset.display;
    
    // Update input display
    const input = document.getElementById(fieldId);
    input.value = display;
    
    // Update hidden value
    const hiddenInput = document.getElementById(`${fieldId}-value`);
    if (hiddenInput) {
        hiddenInput.value = code;
    }
    
    // Update state
    state.formParams[fieldId] = code;
    state.formParams[`${fieldId}Term`] = display;
    
    // Hide suggestions
    const suggestionsEl = document.getElementById(`${fieldId}-suggestions`);
    suggestionsEl.classList.remove('active');
    
    // Regenerate ECL
    generateEcl();
}

// ===== ECL Generation =====
function generateEcl() {
    if (!state.currentTemplate) {
        elements.eclOutput.innerHTML = '<code>// Select a template to generate ECL</code>';
        state.currentEcl = '';
        return;
    }
    
    const template = QUERY_TEMPLATES[state.currentTemplate];
    const ecl = template.buildQuery(state.formParams);
    state.currentEcl = ecl;
    
    elements.eclOutput.innerHTML = `<code>${formatEcl(ecl)}</code>`;
}

// ===== Query Execution =====
async function executeQuery() {
    if (!state.currentEcl) {
        showToast('Please select a template and configure the query first');
        return;
    }
    
    showLoading();
    
    try {
        const results = await expandValueSet(state.currentEcl);
        displayResults(results);
    } catch (error) {
        console.error('Query execution error:', error);
        displayError(error.message);
    } finally {
        hideLoading();
    }
}

function displayResults(results) {
    if (!results.expansion || !results.expansion.contains || results.expansion.contains.length === 0) {
        elements.resultsContainer.innerHTML = `
            <div class="results-placeholder">
                <i class="fas fa-inbox"></i>
                <p>No results found for this query</p>
            </div>
        `;
        elements.resultCount.textContent = '0 results';
        return;
    }
    
    const concepts = results.expansion.contains;
    const total = results.expansion.total || concepts.length;
    
    elements.resultCount.textContent = `${total.toLocaleString()} results${total > concepts.length ? ` (showing ${concepts.length})` : ''}`;
    
    let html = '<div class="results-list">';
    
    concepts.forEach((concept, index) => {
        html += `
            <div class="result-item">
                <div class="result-icon">
                    <i class="fas fa-cube"></i>
                </div>
                <div class="result-content">
                    <div class="result-code">${concept.code}</div>
                    <div class="result-term">${concept.display}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    elements.resultsContainer.innerHTML = html;
}

function displayError(message) {
    elements.resultsContainer.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Error executing query</p>
            <p style="font-size: 0.8rem; margin-top: 8px;">${message}</p>
        </div>
    `;
    elements.resultCount.textContent = '';
}

// ===== Clear Query =====
function clearQuery() {
    state.currentTemplate = null;
    state.formParams = {};
    state.currentEcl = '';
    
    // Remove active class from all template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Reset UI
    elements.queryDescription.innerHTML = '<p>Select a template from the left panel to get started, or choose "Custom Query" to write your own ECL expression.</p>';
    elements.builderForm.innerHTML = `
        <div class="form-placeholder">
            <i class="fas fa-arrow-left"></i>
            <p>Select a query template to configure parameters</p>
        </div>
    `;
    elements.eclOutput.innerHTML = '<code>// ECL query will appear here</code>';
    elements.resultsContainer.innerHTML = `
        <div class="results-placeholder">
            <i class="fas fa-search"></i>
            <p>Execute a query to see results</p>
        </div>
    `;
    elements.resultCount.textContent = '';
}

// ===== Copy ECL =====
function copyEclToClipboard() {
    if (!state.currentEcl) {
        showToast('No ECL to copy');
        return;
    }
    
    navigator.clipboard.writeText(state.currentEcl).then(() => {
        showToast('ECL copied to clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Failed to copy');
    });
}

// ===== Example Queries =====
function handleExampleClick(e) {
    const exampleId = e.currentTarget.dataset.example;
    const example = EXAMPLE_QUERIES[exampleId];
    
    if (!example) return;
    
    // Scroll to builder
    document.getElementById('builder').scrollIntoView({ behavior: 'smooth' });
    
    setTimeout(() => {
        if (example.ecl) {
            // Direct ECL - use custom template
            selectTemplate('custom');
            state.formParams.customEcl = example.ecl;
            document.getElementById('customEcl').value = example.ecl;
            generateEcl();
        } else if (example.template && example.params) {
            // Use template with params
            selectTemplate(example.template);
            Object.assign(state.formParams, example.params);
            
            // Update form fields
            Object.keys(example.params).forEach(key => {
                const input = document.getElementById(key);
                if (input) {
                    if (key.endsWith('Term')) {
                        // This is a term, find the related input
                        const fieldId = key.replace('Term', '');
                        const relatedInput = document.getElementById(fieldId);
                        if (relatedInput) {
                            relatedInput.value = example.params[key];
                        }
                    } else {
                        input.value = example.params[key];
                    }
                }
            });
            
            generateEcl();
        }
    }, 500);
}

// ===== Smooth Scrolling =====
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80; // Account for fixed navbar
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ===== Event Listeners =====
function initEventListeners() {
    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Template buttons (only on builder page)
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => selectTemplate(btn.dataset.template));
    });
    
    // Execute query (only on builder page)
    if (elements.executeQuery) {
        elements.executeQuery.addEventListener('click', executeQuery);
    }
    
    // Clear query (only on builder page)
    if (elements.clearQuery) {
        elements.clearQuery.addEventListener('click', clearQuery);
    }
    
    // Copy ECL (only on builder page)
    if (elements.copyEcl) {
        elements.copyEcl.addEventListener('click', copyEclToClipboard);
    }
    
    // Example buttons (only on index page with old single-page layout)
    document.querySelectorAll('.try-btn[data-example]').forEach(btn => {
        btn.addEventListener('click', handleExampleClick);
    });
    
    // Mobile menu
    if (elements.mobileMenu) {
        elements.mobileMenu.addEventListener('click', () => {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
            }
        });
    }
}

// ===== Initialization =====
function init() {
    initTheme();
    initEventListeners();
    initSmoothScroll();
    
    // Check for example parameter in URL (for links from examples page)
    const urlParams = new URLSearchParams(window.location.search);
    const exampleId = urlParams.get('example');
    if (exampleId && EXAMPLE_QUERIES[exampleId]) {
        setTimeout(() => {
            loadExample(exampleId);
        }, 100);
    }
    
    console.log('ABC of ECL initialized');
    console.log(`FHIR Server: ${CONFIG.fhirServer}`);
}

// Load example from URL parameter
function loadExample(exampleId) {
    const example = EXAMPLE_QUERIES[exampleId];
    if (!example) return;
    
    if (example.ecl) {
        selectTemplate('custom');
        state.formParams.customEcl = example.ecl;
        const textarea = document.getElementById('customEcl');
        if (textarea) textarea.value = example.ecl;
        generateEcl();
    } else if (example.template && example.params) {
        selectTemplate(example.template);
        Object.assign(state.formParams, example.params);
        
        Object.keys(example.params).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                if (key.endsWith('Term')) {
                    const fieldId = key.replace('Term', '');
                    const relatedInput = document.getElementById(fieldId);
                    if (relatedInput) {
                        relatedInput.value = example.params[key];
                    }
                } else {
                    input.value = example.params[key];
                }
            }
        });
        
        generateEcl();
    }
}

// ===== Changelog Modal =====
function initChangelogModal() {
    const changelogLink = document.getElementById('changelogLink');
    const changelogModal = document.getElementById('changelogModal');
    const changelogClose = document.getElementById('closeChangelog');
    const changelogBody = document.getElementById('changelogContent');
    
    if (!changelogLink || !changelogModal) return;
    
    changelogLink.addEventListener('click', async (e) => {
        e.preventDefault();
        changelogModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Load changelog if not already loaded
        if (changelogBody && changelogBody.querySelector('.modal-loading')) {
            try {
                const response = await fetch('CHANGELOG.md');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const markdown = await response.text();
                changelogBody.innerHTML = `<div class="changelog-content">${parseMarkdown(markdown)}</div>`;
            } catch (error) {
                console.error('Changelog load error:', error);
                changelogBody.innerHTML = `<p style="color: var(--error);">Failed to load changelog: ${error.message}</p>`;
            }
        }
    });
    
    changelogClose?.addEventListener('click', closeChangelogModal);
    
    changelogModal.addEventListener('click', (e) => {
        if (e.target === changelogModal) {
            closeChangelogModal();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && changelogModal.classList.contains('active')) {
            closeChangelogModal();
        }
    });
}

function closeChangelogModal() {
    const changelogModal = document.getElementById('changelogModal');
    if (changelogModal) {
        changelogModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function parseMarkdown(markdown) {
    // Simple markdown to HTML parser
    return markdown
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Unordered lists (process blocks)
        .replace(/(?:^- .+$\n?)+/gm, (match) => {
            const items = match.trim().split('\n')
                .map(line => `<li>${line.replace(/^- /, '')}</li>`)
                .join('');
            return `<ul>${items}</ul>`;
        })
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Line breaks for remaining text
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[huplo])(.+)$/gm, '<p>$1</p>')
        // Clean up empty paragraphs
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<[hulo])/g, '$1')
        .replace(/(<\/[hulo][^>]*>)<\/p>/g, '$1');
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    init();
    initChangelogModal();
});

