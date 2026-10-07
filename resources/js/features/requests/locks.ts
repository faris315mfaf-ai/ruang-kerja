import type { FormCategory, FormLeaveType } from '@/types/requests';

/**
 * Locked request types (keputusan pemilik 6 Okt 2026: cuti & lembur wait for
 * the SOP). A locked type stays visible as a lock tile but cannot be chosen.
 */

/** Every type of the category is locked. */
export function categoryLocked(category: Pick<FormCategory, 'types'>): boolean {
    return (
        category.types.length > 0 && category.types.every((type) => type.locked)
    );
}

/** Lock reason shown on a locked category tile. */
export function categoryLockReason(
    category: Pick<FormCategory, 'types'>,
): string | null {
    if (!categoryLocked(category)) {
        return null;
    }

    return (
        category.types.find((type) => type.locked_reason)?.locked_reason ??
        'Dikunci oleh HR.'
    );
}

/** Default type of a category: open and eligible first, then open, then any. */
export function firstOpenType(
    types: FormLeaveType[],
): FormLeaveType | undefined {
    return (
        types.find((type) => !type.locked && type.eligible) ??
        types.find((type) => !type.locked) ??
        types[0]
    );
}
