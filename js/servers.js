/**
 * Terminology server registry.
 *
 * Each entry describes a FHIR terminology endpoint, how to authenticate to it,
 * and which drug model its content uses. Templates read the model description
 * rather than hard-coding concept IDs, so swapping servers is a config change.
 *
 * NOTE ON SECRETS: no credentials are stored in this file, ever. Servers that
 * need authentication read credentials the user has entered into their own
 * browser (see auth.js). This site is fully static and public, so anything
 * committed here would be world-readable.
 */

/** dm+d-style product model: VTM -> VMP -> AMP, with VMPP/AMPP packs. */
const DMD_IE = {
    id: 'dmd-ie',
    label: 'Irish NMPC (dm+d style)',
    levels: [
        { key: 'vtm',  refset: '660351000220100', name: 'VTM',  label: 'Virtual Therapeutic Moiety',
          blurb: 'The substance a prescriber has in mind, with no strength, form or brand. "Paracetamol".' },
        { key: 'vmp',  refset: '660371000220109', name: 'VMP',  label: 'Virtual Medicinal Product',
          blurb: 'A generic product with strength and dose form, but no brand. "Paracetamol 500 mg oral tablet".' },
        { key: 'vmpp', refset: '660391000220105', name: 'VMPP', label: 'Virtual Medicinal Product Pack',
          blurb: 'A generic product in a pack size. "Paracetamol 500 mg oral tablet (24 tablets)".' },
        { key: 'amp',  refset: '660381000220107', name: 'AMP',  label: 'Actual Medicinal Product',
          blurb: 'A specific branded product from a named manufacturer. "Paracetamol Accord 500 mg tablet".' },
        { key: 'ampp', refset: '660401000220107', name: 'AMPP', label: 'Actual Medicinal Product Pack',
          blurb: 'The branded product as it is actually dispensed, in its pack. What a pharmacy hands over.' },
        { key: 'atm',  refset: '660361000220103', name: 'ATM',  label: 'Actual Therapeutic Moiety',
          blurb: 'The branded equivalent of a VTM, a brand name without strength or form.' }
    ],
    attributes: {
        hasActiveIngredient:        { id: '127489000',       term: 'Has active ingredient' },
        hasPreciseActiveIngredient: { id: '762949000',       term: 'Has precise active ingredient' },
        hasManufacturedDoseForm:    { id: '411116001',       term: 'Has manufactured dose form' },
        hasBasisOfStrength:         { id: '732943007',       term: 'Has basis of strength substance' },
        strengthNumeratorValue:     { id: '1142135004',      term: 'Has presentation strength numerator value' },
        strengthNumeratorUnit:      { id: '732945000',       term: 'Has presentation strength numerator unit' },
        packSize:                   { id: '1142142004',      term: 'Has pack size' },
        containsClinicalDrug:       { id: '774160008',       term: 'Contains clinical drug' },
        hasProductName:             { id: '774158006',       term: 'Has product name' },
        marketingAuthHolder:        { id: '680061000220102', term: 'Has marketing authorisation holder' },
        marketingStatus:            { id: '680051000220104', term: 'Has marketing status' },
        licensingStatus:            { id: '680341000220104', term: 'Has licensing status' },
        licensedRoute:              { id: '680321000220105', term: 'Has licensed route of administration' },
        dispensingLegalStatus:      { id: '680081000220106', term: 'Has dispensing legal status' },
        supplyLegalStatus:          { id: '680771000220105', term: 'Has supply legal status' },
        productAuthNumber:          { id: '680041000220101', term: 'Has product authorisation number' },
        nmpcProductType:            { id: '680011000220100', term: 'Has NMPC product type' },
        nmpcDoseFormType:           { id: '680311000220103', term: 'Has NMPC dose form type' }
    },
    /** Hierarchy roots used to scope concept-search pickers. */
    pickers: {
        substance:             { ecl: '< 105590001 |Substance|',                        label: 'Substance' },
        doseForm:              { ecl: '< 736542009 |Pharmaceutical dose form|',          label: 'Dose form' },
        route:                 { ecl: '< 284009009 |Route of administration value|',     label: 'Route' },
        marketingStatus:       { ecl: '< 679951000220103 |Marketing Status|',            label: 'Marketing status' },
        licensingStatus:       { ecl: '< 679931000220109 |Licensing Status|',            label: 'Licensing status' },
        supplyLegalStatus:     { ecl: '< 680711000220102 |Supply legal status|',         label: 'Supply legal status' },
        dispensingLegalStatus: { ecl: '< 670041000220107 |Dispensing Legal Status|',     label: 'Dispensing legal status' },
        nmpcProductType:       { ecl: '< 679901000220102 |NMPC Product Type|',           label: 'NMPC product type' },
        anyProduct:            { ecl: '< 763158003 |Medicinal product|',                 label: 'Medicinal product' },
        anyConcept:            { ecl: '*',                                               label: 'Any concept' }
    },
    /** Reference sets worth exposing as ready-made membership queries. */
    namedRefsets: [
        { id: '679971000220107', term: 'Non prescribable indicator' },
        { id: '679941000220100', term: 'Parallel Import Indicator' },
        { id: '680291000220102', term: 'Aggregate licensing status indicator' }
    ],
    defaults: {
        substance:        { id: '387517004', term: 'Paracetamol' },
        vtm:              { id: '777067000', term: 'Paracetamol' },
        doseForm:         { id: '385268001', term: 'Oral dose form' },
        allergySubstance: { id: '764146007', term: 'Penicillin' }
    }
};

/**
 * International/AU model as served by the public CSIRO Ontoserver.
 * Kept as the anonymous fallback so the site works without credentials.
 */
const INTL_AU = {
    id: 'intl-au',
    label: 'SNOMED CT international drug model',
    levels: [],
    attributes: {
        hasActiveIngredient:        { id: '127489000',  term: 'Has active ingredient' },
        hasPreciseActiveIngredient: { id: '762949000',  term: 'Has precise active ingredient' },
        hasManufacturedDoseForm:    { id: '411116001',  term: 'Has manufactured dose form' },
        strengthNumeratorValue:     { id: '1142135004', term: 'Has presentation strength numerator value' },
        strengthNumeratorUnit:      { id: '732945000',  term: 'Has presentation strength numerator unit' }
    },
    pickers: {
        substance:  { ecl: '< 105590001 |Substance|',                label: 'Substance' },
        doseForm:   { ecl: '< 736542009 |Pharmaceutical dose form|', label: 'Dose form' },
        anyProduct: { ecl: '< 763158003 |Medicinal product|',        label: 'Medicinal product' },
        anyConcept: { ecl: '*',                                      label: 'Any concept' }
    },
    namedRefsets: [],
    defaults: {
        substance:        { id: '387517004', term: 'Paracetamol' },
        doseForm:         { id: '385268001', term: 'Oral dose form' },
        allergySubstance: { id: '764146007', term: 'Penicillin' }
    }
};

export const SERVERS = {
    'nmpc-ie': {
        id: 'nmpc-ie',
        name: 'HSE NMPC',
        region: 'Ireland',
        fhirBase: 'https://nmpc.hse.ie/production1/fhir',
        edition: 'Irish drugs module',
        editionUri: 'http://snomed.info/sct/1601000220105',
        docsUrl: 'https://nmpc.hse.ie/browser',
        auth: {
            type: 'oauth2-client-credentials',
            tokenUrl: 'https://nmpc.hse.ie/authorisation/auth/realms/terminology/protocol/openid-connect/token',
            // Shown in the sign-in panel. Keep it about where credentials come
            // from; the panel supplies the generic framing around it.
            note: 'Credentials for this server are issued by the HSE.'
        },
        model: DMD_IE
    },
    'ontoserver-au': {
        id: 'ontoserver-au',
        name: 'CSIRO Ontoserver',
        region: 'International',
        fhirBase: 'https://r4.ontoserver.csiro.au/fhir',
        edition: 'SNOMED CT-AU',
        editionUri: 'http://snomed.info/sct/32506021000036107',
        docsUrl: 'https://confluence.csiro.au/display/FHIR/Ontoserver',
        auth: { type: 'none' },
        model: INTL_AU,
        // Not offered in the UI: this deployment serves Ireland only. Kept in the
        // registry so it stays tested, and so re-enabling it (or adding another
        // country) is a flag rather than a rewrite.
        hidden: true
    }
};

/** The server this deployment targets. Ireland only for now. */
export const DEFAULT_SERVER_ID = 'nmpc-ie';

const STORAGE_KEY = 'ecl.serverId';

/** Servers offered to the visitor. Hidden entries stay in the registry. */
export function listServers({ includeHidden = false } = {}) {
    return Object.values(SERVERS).filter(s => includeHidden || !s.hidden);
}

/** True when more than one server is selectable, i.e. the picker is worth showing. */
export function hasServerChoice() {
    return listServers().length > 1;
}

export function getServer(id) {
    return SERVERS[id] || SERVERS[DEFAULT_SERVER_ID];
}

export function getSelectedServerId() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        // A saved id that has since been hidden must not strand the visitor there.
        if (saved && SERVERS[saved] && !SERVERS[saved].hidden) return saved;
    } catch (e) { /* storage unavailable */ }
    return DEFAULT_SERVER_ID;
}

export function setSelectedServerId(id) {
    if (!SERVERS[id]) return;
    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* ignore */ }
}
