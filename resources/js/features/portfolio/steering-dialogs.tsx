import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { requestUpdate } from '@/routes/projects';
import { store as storeDirection } from '@/routes/projects/directions';
import { fieldClass, ResponsiveSheet } from './parts';

type Target = { key: string; name: string };

/**
 * "Beri arahan" / "Balas" / "Diskusikan": direction to the PIC, optionally
 * on one update.
 */
export function DirectionDialog({
    project,
    updateId,
    open,
    onOpenChange,
    context,
}: {
    project: Target | null;
    updateId?: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Quoted text the direction answers (decision or update summary). */
    context?: string | null;
}) {
    const form = useForm({ body: '', project_update_id: updateId ?? '' });

    const submit = (event?: FormEvent) => {
        event?.preventDefault();

        if (!project) {
            return;
        }

        form.transform((data) => ({
            ...data,
            project_update_id: updateId ?? null,
        }));
        form.submit(storeDirection(project.key), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <ResponsiveSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Beri arahan"
            description={
                project
                    ? `Dikirim ke PIC ${project.name} dan tercatat di Aktivitas proyek.`
                    : undefined
            }
            footer={
                <div className="flex w-full justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 md:h-9"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        className="h-11 md:h-9"
                        disabled={
                            form.processing || form.data.body.trim() === ''
                        }
                        onClick={() => submit()}
                    >
                        Kirim
                    </Button>
                </div>
            }
        >
            <form onSubmit={submit} className="space-y-3">
                {context && (
                    <blockquote className="rounded-md border-l-2 border-primary bg-surface-2 px-3 py-2 text-[13px] text-text-muted">
                        {context}
                    </blockquote>
                )}
                <label className="block space-y-1.5">
                    <span className="sr-only">Arahan</span>
                    <textarea
                        className={`${fieldClass} min-h-28`}
                        placeholder="Tulis arahan untuk PIC…"
                        value={form.data.body}
                        maxLength={2000}
                        autoFocus
                        onChange={(event) =>
                            form.setData('body', event.target.value)
                        }
                    />
                </label>
                <InputError
                    message={form.errors.body ?? form.errors.project_update_id}
                />
            </form>
        </ResponsiveSheet>
    );
}

/** "Minta update" with an optional note. */
export function RequestUpdateDialog({
    project,
    leadName,
    open,
    onOpenChange,
}: {
    project: Target | null;
    leadName?: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({ note: '' });

    const submit = (event?: FormEvent) => {
        event?.preventDefault();

        if (!project) {
            return;
        }

        form.submit(requestUpdate(project.key), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <ResponsiveSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Minta update"
            description={
                project
                    ? `${leadName ?? 'PIC'} akan menerima notifikasi untuk menulis update ${project.name}.`
                    : undefined
            }
            footer={
                <div className="flex w-full justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 md:h-9"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        className="h-11 md:h-9"
                        disabled={form.processing}
                        onClick={() => submit()}
                    >
                        Kirim permintaan
                    </Button>
                </div>
            }
        >
            <form onSubmit={submit} className="space-y-2">
                <label className="block space-y-1.5">
                    <span className="text-[13px] font-medium text-text">
                        Catatan (opsional)
                    </span>
                    <textarea
                        className={`${fieldClass} min-h-20`}
                        placeholder="Mis. mohon update sebelum rapat Senin."
                        value={form.data.note}
                        maxLength={500}
                        onChange={(event) =>
                            form.setData('note', event.target.value)
                        }
                    />
                </label>
                <InputError message={form.errors.note} />
            </form>
        </ResponsiveSheet>
    );
}
