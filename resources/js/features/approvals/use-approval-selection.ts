import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { bulk } from '@/routes/approvals';

/** Same cap as BulkApproveRequest (`ids` max:100). */
export const BULK_LIMIT = 100;

/** Adds or removes one id, keeping the order of selection. */
export function toggleId(ids: readonly string[], id: string): string[] {
    return ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id];
}

/**
 * Ids still present in the list: after a bulk approve or a reload, items that
 * left the queue drop out of the selection on their own.
 */
export function visibleSelection(
    ids: readonly string[],
    itemIds: readonly string[],
): string[] {
    return ids.filter((id) => itemIds.includes(id));
}

export function isAllSelected(
    ids: readonly string[],
    itemIds: readonly string[],
): boolean {
    return (
        itemIds.length > 0 &&
        Math.min(itemIds.length, BULK_LIMIT) ===
            visibleSelection(ids, itemIds).length
    );
}

/** "Pilih semua" toggles between every item of the tab (up to the cap) and none. */
export function toggleAll(
    ids: readonly string[],
    itemIds: readonly string[],
): string[] {
    return isAllSelected(ids, itemIds) ? [] : itemIds.slice(0, BULK_LIMIT);
}

/**
 * Selection mode of the mobile approval queue ("Pilih"): pick several waiting
 * requests and approve them at once through the same bulk endpoint as desktop.
 * Rejecting needs a note per request, so it stays a one-by-one action.
 */
export function useApprovalSelection(itemIds: readonly string[]) {
    const [active, setActive] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);
    const [processing, setProcessing] = useState(false);
    const ids = visibleSelection(picked, itemIds);

    const start = () => {
        setPicked([]);
        setActive(true);
    };

    const cancel = () => {
        setActive(false);
        setPicked([]);
    };

    const approve = () => {
        if (ids.length === 0 || processing) {
            return;
        }

        router.post(
            bulk.url(),
            { ids },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: cancel,
                onError: (errors) =>
                    toast.error(
                        Object.values(errors)[0] ??
                            'Pengajuan gagal disetujui.',
                    ),
            },
        );
    };

    return {
        active,
        ids,
        count: ids.length,
        processing,
        allSelected: isAllSelected(ids, itemIds),
        isSelected: (id: string) => ids.includes(id),
        start,
        cancel,
        toggle: (id: string) => setPicked((current) => toggleId(current, id)),
        toggleAll: () => setPicked(toggleAll(ids, itemIds)),
        approve,
    };
}

export type ApprovalSelection = ReturnType<typeof useApprovalSelection>;
