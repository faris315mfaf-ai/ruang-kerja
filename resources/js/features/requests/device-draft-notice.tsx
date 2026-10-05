import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
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
            className="flex items-center gap-2.5 rounded-lg border border-info/30 bg-info/10 px-4 py-2.5 text-sm text-text"
        >
            <History className="size-4 shrink-0 text-info" aria-hidden />
            <p className="min-w-0 flex-1">
                <strong className="font-semibold">
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
                variant="ghost"
                size="sm"
                className={cn('shrink-0', mobile && 'h-11 px-4 text-base')}
                onClick={state.discardDeviceDraft}
            >
                Buang
            </Button>
        </div>
    );
}
