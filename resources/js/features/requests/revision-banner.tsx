import { CornerUpLeft } from 'lucide-react';
import type { RequestDetail } from '@/types/requests';

/** Shown on the edit form when an approver asked for a revision. */
export function RevisionBanner({ request }: { request: RequestDetail }) {
    if (request.status !== 'revision_requested' || !request.decision_note) {
        return null;
    }

    return (
        <div
            role="note"
            className="flex gap-2.5 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-text"
        >
            <CornerUpLeft
                className="mt-0.5 size-4 shrink-0 text-info"
                aria-hidden
            />
            <p>
                <strong className="font-semibold">
                    {request.decision_note.by ?? 'Penyetuju'} meminta revisi:
                </strong>{' '}
                “{request.decision_note.note}”. Ubah lalu kirim ulang.
            </p>
        </div>
    );
}
