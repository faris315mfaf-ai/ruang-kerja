import { Link2, Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { STATUS_CATEGORY_LABELS, StatusIcon } from '@/components/status-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, requestJson } from '@/features/tasks/lib/api';
import { formatDate } from '@/lib/format';
import keyResultTaskRoutes from '@/routes/okr/key-results/tasks';
import { Field, ResponsiveFormDialog } from './parts';
import type { KeyResult, LinkedTask } from './types';

const TITLE = 'Tautkan tugas';

/**
 * Picker of the tasks a key result may be linked to: tasks the viewer sees in
 * a workspace of the objective's division (server: LinkableTasks). Search by
 * title or "KEY-12"; already linked tasks are not offered.
 */
export function LinkTaskDialog({
    open,
    onOpenChange,
    mobile,
    keyResult,
    onLink,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobile: boolean;
    keyResult: KeyResult | null;
    onLink: (taskId: string) => Promise<boolean>;
}) {
    const id = useId();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<LinkedTask[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [linking, setLinking] = useState<string | null>(null);
    const keyResultId = keyResult?.id ?? null;

    useEffect(() => {
        if (open) {
            setQuery('');
            setResults(null);
            setError(null);
        }
    }, [open]);

    useEffect(() => {
        if (!open || keyResultId === null) {
            return;
        }

        let active = true;
        const timer = window.setTimeout(() => {
            requestJson<{ tasks: LinkedTask[] }>(
                keyResultTaskRoutes.index(keyResultId, {
                    query: { q: query.trim() || undefined },
                }),
            )
                .then((response) => {
                    if (active) {
                        setResults(response.tasks);
                        setError(null);
                    }
                })
                .catch((caught: unknown) => {
                    if (active) {
                        setError(
                            caught instanceof ApiError
                                ? caught.message
                                : 'Tugas gagal dimuat. Coba lagi.',
                        );
                    }
                });
        }, 250);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [open, keyResultId, query]);

    const link = async (task: LinkedTask) => {
        setLinking(task.id);
        const linked = await onLink(task.id);
        setLinking(null);

        if (linked) {
            setResults(
                (current) =>
                    current?.filter((item) => item.id !== task.id) ?? null,
            );
        }
    };

    return (
        <ResponsiveFormDialog
            open={open}
            onOpenChange={onOpenChange}
            mobile={mobile}
            title={TITLE}
            description={keyResult?.title}
            onSubmit={(event) => event.preventDefault()}
            actions={
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                >
                    Selesai
                </Button>
            }
        >
            <Field
                id={`${id}-q`}
                label="Cari tugas divisi"
                hint="Judul atau nomor tugas, mis. OPS-12"
            >
                <div className="relative">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-subtle"
                    />
                    <Input
                        id={`${id}-q`}
                        type="search"
                        value={query}
                        autoComplete="off"
                        className="pl-10"
                        aria-describedby={`${id}-q-hint`}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
            </Field>

            <div aria-live="polite" className="flex min-h-40 flex-col">
                {error ? (
                    <p className="text-[15px] text-danger">{error}</p>
                ) : results === null ? (
                    <div
                        className="flex flex-col gap-2"
                        aria-busy
                        aria-label="Memuat"
                    >
                        <Skeleton className="h-14" />
                        <Skeleton className="h-14" />
                        <Skeleton className="h-14" />
                    </div>
                ) : results.length === 0 ? (
                    <p className="py-6 text-center text-[15px] text-text-muted">
                        {query.trim()
                            ? 'Tidak ada tugas divisi yang cocok.'
                            : 'Belum ada tugas divisi yang bisa ditautkan.'}
                    </p>
                ) : (
                    <ul className="flex flex-col">
                        {results.map((task) => (
                            <li
                                key={task.id}
                                className="flex min-h-14 items-center gap-3 border-t border-divider py-2 first:border-t-0"
                            >
                                <StatusIcon
                                    category={task.status_category}
                                    label={
                                        STATUS_CATEGORY_LABELS[
                                            task.status_category
                                        ]
                                    }
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[15px] font-semibold">
                                        <span className="mr-1.5 font-mono text-[14px] text-text-muted">
                                            {task.key}
                                        </span>
                                        {task.title}
                                    </span>
                                    <span className="text-[13px] text-text-muted">
                                        {
                                            STATUS_CATEGORY_LABELS[
                                                task.status_category
                                            ]
                                        }
                                        {task.assignee &&
                                            ` · ${task.assignee.name}`}
                                        {task.due_date &&
                                            ` · tenggat ${formatDate(task.due_date)}`}
                                    </span>
                                </span>
                                <Button
                                    type="button"
                                    variant="tonal"
                                    size="sm"
                                    className="h-11 shrink-0 md:h-9"
                                    disabled={linking !== null}
                                    aria-label={`Tautkan ${task.key} ${task.title}`}
                                    onClick={() => link(task)}
                                >
                                    {linking === task.id ? (
                                        <Spinner />
                                    ) : (
                                        <Link2 aria-hidden />
                                    )}
                                    Tautkan
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </ResponsiveFormDialog>
    );
}
