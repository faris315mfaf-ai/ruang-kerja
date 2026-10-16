let rowCounter = 0;
const nextRowId = () => `plan-${++rowCounter}`;

/**
 * Stable React keys for the removable work-plan inputs: keep `ids` as long
 * as `length` by dropping from the end / appending fresh ids.
 */
export function resizeRowIds(ids: string[], length: number): string[] {
    return ids.length >= length
        ? ids.slice(0, length)
        : [...ids, ...Array.from({ length: length - ids.length }, nextRowId)];
}
