import type { DocGroup, DocListItem } from './types';

export type DocSection = { group: DocGroup; documents: DocListItem[] };

/** Lower-case, accent-free text for matching ("Ringkasan—Sprint" → "ringkasan-sprint"). */
function fold(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

/**
 * Documents whose title or path contains every word of the query, grouped in
 * group order (groups without matches are left out). Documents of unknown
 * groups come last under "Lainnya".
 */
export function filterDocs(
    documents: DocListItem[],
    groups: DocGroup[],
    query: string,
): DocSection[] {
    const words = fold(query).split(/\s+/).filter(Boolean);
    const matches = documents.filter((doc) => {
        const haystack = fold(`${doc.title} ${doc.path}`);

        return words.every((word) => haystack.includes(word));
    });

    const known = new Set(groups.map((group) => group.key));
    const sections = groups
        .map((group) => ({
            group,
            documents: matches.filter((doc) => doc.group === group.key),
        }))
        .filter((section) => section.documents.length > 0);

    const others = matches.filter((doc) => !known.has(doc.group));

    if (others.length > 0) {
        sections.push({
            group: { key: 'other', label: 'Lainnya' },
            documents: others,
        });
    }

    return sections;
}
