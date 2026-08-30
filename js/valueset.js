/**
 * Export a query as something a terminology system will accept.
 *
 * CSV and JSON cover pasting into a ticket. This covers handing the query to a
 * system: a FHIR ValueSet whose compose rule *is* the ECL, so the definition
 * travels rather than just today's expansion.
 *
 * An expansion is only meaningful alongside the version that produced it, so
 * the SNOMED edition and the retrieval timestamp are always stamped in.
 */

const SNOMED = 'http://snomed.info/sct';

/** A stable, readable id from a template name. */
function slugify(text) {
    return String(text || 'ecl-query')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'ecl-query';
}

/**
 * Build the ValueSet definition: the ECL preserved as an intensional
 * compose rule, which is the form other systems can re-expand for themselves.
 */
export function buildValueSet(ecl, {
    name = 'ECL query',
    server,
    editionVersion = null,
    expansion = null,
    total = null
} = {}) {
    const id = slugify(name);
    const stamp = new Date().toISOString();

    const include = {
        system: SNOMED,
        filter: [{ property: 'constraint', op: '=', value: ecl }]
    };
    // Pinning the version makes the definition reproducible. Without it the
    // same ValueSet expands differently after every SNOMED release.
    if (editionVersion) include.version = editionVersion;

    const valueSet = {
        resourceType: 'ValueSet',
        id,
        url: `urn:uuid:${cryptoUuid()}`,
        version: stamp.slice(0, 10),
        name: id.replace(/-/g, '_'),
        title: name,
        status: 'draft',
        experimental: true,
        date: stamp,
        publisher: 'ABC of ECL',
        description: `Concepts selected by the expression constraint: ${ecl.replace(/\s+/g, ' ')}`,
        copyright: 'This value set includes content from SNOMED CT, which is copyright of the International Health Terminology Standards Development Organisation (IHTSDO). Use is subject to an affiliate licence.',
        compose: { include: [include] }
    };

    if (expansion && expansion.length) {
        valueSet.expansion = {
            identifier: `urn:uuid:${cryptoUuid()}`,
            timestamp: stamp,
            total: typeof total === 'number' ? total : expansion.length,
            offset: 0,
            parameter: [
                { name: 'version', valueUri: editionVersion || SNOMED },
                { name: 'used-codesystem', valueUri: editionVersion || SNOMED },
                ...(server ? [{ name: 'expansion-source', valueUri: server.fhirBase }] : [])
            ],
            contains: expansion.map(c => ({ system: SNOMED, code: c.code, display: c.display }))
        };
        // Say so when the expansion in the file is only part of the answer.
        if (typeof total === 'number' && total > expansion.length) {
            valueSet.expansion.parameter.push({
                name: 'partial-expansion',
                valueString: `This file contains ${expansion.length} of ${total} concepts. Re-expand the compose rule for the complete set.`
            });
        }
    }

    return valueSet;
}

/** RFC4122 v4, using the platform CSPRNG where available. */
function cryptoUuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function valueSetJson(...args) {
    return JSON.stringify(buildValueSet(...args), null, 2);
}

/** Suggested filename for a downloaded ValueSet. */
export function valueSetFilename(name) {
    return `valueset-${slugify(name)}-${new Date().toISOString().slice(0, 10)}.json`;
}

/**
 * Hand the browser a file. Unlike the copy path this needs a real document, so
 * it is only called from page code.
 */
export function downloadJson(filename, text) {
    const blob = new Blob([text], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke on the next tick; revoking immediately can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
