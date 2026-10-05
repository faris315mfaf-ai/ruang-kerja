import { useForm } from '@inertiajs/react';
import { approve, reject, revise } from '@/routes/approvals';

export type DecisionKind = 'approve' | 'reject' | 'revise';

/**
 * Approve / reject / revision for one request, shared by the desktop panel,
 * the mobile detail and the swipe actions. Reject and revision need a note.
 */
export function useDecision(requestId: string, redirect?: 'next') {
    const form = useForm<{ note: string; redirect: string }>({
        note: '',
        redirect: redirect ?? '',
    });

    const decide = (kind: DecisionKind, onSuccess?: () => void) => {
        if (kind !== 'approve' && form.data.note.trim() === '') {
            form.setError(
                'note',
                kind === 'reject'
                    ? 'Alasan wajib diisi saat menolak.'
                    : 'Catatan wajib diisi saat meminta revisi.',
            );

            return;
        }

        const route =
            kind === 'approve' ? approve : kind === 'reject' ? reject : revise;
        form.post(route.url({ employeeRequest: requestId }), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset('note');
                onSuccess?.();
            },
        });
    };

    return { form, decide };
}
