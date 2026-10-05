import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import type { RequestFormState } from './use-request-form';

/** "Draf dipulihkan dari perangkat ini" + Buang (device autosave of the form). */
export function DeviceDraftNotice({
    state,
    mobile = false,
}: {
    state: RequestFormState;
    mobile?: boolean;
}) {
    const draft = state.restoredDraft;

    if (!draft) {
        return null;
    }

    return (
        <div
            role="status"
            className="flex items-center gap-3 rounded-lg bg-info-soft px-4 py-2 text-[16px] text-text"
        >
            <History className="size-5 shrink-0 text-info" aria-hidden />
            <p className="min-w-0 flex-1">
                <strong className="font-bold">
                    Draf dipulihkan dari perangkat ini
                </strong>
                {draft.savedAt && (
                    <span className="text-text-muted">
                        {' '}
                        · {formatDateTime(draft.savedAt)}
                    </span>
                )}
            </p>
            <Button
                type="button"
                variant="quiet"
                size={mobile ? 'default' : 'sm'}
                className="shrink-0"
                onClick={state.discardDeviceDraft}
            >
                Buang
            </Button>
        </div>
    );
}
