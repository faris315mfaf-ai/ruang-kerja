import { Lock, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LANE_LABELS } from './lib';
import type { Lane } from './types';

export const QUICK_ADD_HINT =
    'Masuk ke workspace Pribadi Anda · hanya Anda yang melihat';

/**
 * "Tambah catatan pribadi": a task in the personal workspace, planned in
 * `lane` (Hari ini by default). Keeps the text when saving fails.
 */
export function QuickAdd({
    onAdd,
    lane = 'today',
    autoFocus = false,
    stacked = false,
    onDone,
}: {
    onAdd: (title: string, lane: Lane) => Promise<boolean>;
    lane?: Lane;
    autoFocus?: boolean;
    /** Phone sheet: full-width input above a large button. */
    stacked?: boolean;
    onDone?: () => void;
}) {
    const id = useId();
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (title.trim() === '' || busy) {
            return;
        }

        setBusy(true);
        const saved = await onAdd(title, lane);
        setBusy(false);

        if (saved) {
            setTitle('');
            onDone?.();
        }
    };

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-2"
            aria-describedby={`${id}-hint`}
        >
            <label htmlFor={`${id}-title`} className="sr-only">
                Tambah catatan pribadi
            </label>
            <div className={cn('flex gap-2', stacked && 'flex-col')}>
                <Input
                    id={`${id}-title`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Tambah catatan pribadi"
                    maxLength={255}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    enterKeyHint="done"
                    className="min-w-0 flex-1"
                />
                <Button
                    type="submit"
                    variant={stacked ? 'default' : 'outline'}
                    size={stacked ? 'lg' : 'default'}
                    disabled={title.trim() === '' || busy}
                >
                    <Plus aria-hidden />
                    {stacked ? `Tambah ke ${LANE_LABELS[lane]}` : 'Tambah'}
                </Button>
            </div>
            <p
                id={`${id}-hint`}
                className="flex items-center gap-1.5 text-meta text-text-muted"
            >
                <Lock className="size-3.5 shrink-0" aria-hidden />
                {QUICK_ADD_HINT}
            </p>
        </form>
    );
}
