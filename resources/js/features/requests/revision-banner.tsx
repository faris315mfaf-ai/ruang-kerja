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
            className="flex gap-3 rounded-lg bg-info-soft px-4 py-3.5 text-[16px] leading-6 text-text"
        >
            <CornerUpLeft
                className="mt-0.5 size-5 shrink-0 text-info"
                aria-hidden
            />
            <p>
                <strong className="font-bold">
                    {request.decision_note.by ?? 'Penyetuju'} meminta revisi:
                </strong>{' '}
                “{request.decision_note.note}”. Ubah lalu kirim ulang.
            </p>
        </div>
    );
}
