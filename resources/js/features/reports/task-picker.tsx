import { Plus, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { requestJson } from '@/lib/http';
import { cn, focusRing } from '@/lib/utils';
import type { ReportTaskOption } from './types';

function OptionButton({
    option,
    onPick,
}: {
    option: ReportTaskOption;
    onPick: (option: ReportTaskOption) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onPick(option)}
            className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-2 text-left text-[16px] transition-colors duration-120 ease-brand hover:bg-surface-2',
                focusRing,
            )}
        >
            <Plus className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="shrink-0 font-mono text-[14px] font-semibold text-text-muted">
                {option.key}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-text">
                {option.title}
            </span>
            {option.planned_today && (
                <span className="hidden shrink-0 rounded-full bg-link-soft px-2 py-0.5 text-[13px] font-bold text-link sm:inline">
                    Hari ini
                </span>
            )}
        </button>
    );
}

/**
 * Adds tasks to the report: suggestions (Ruang saya "Hari ini", assigned and
 * open tasks) and a search over every task the writer can see.
 */
export function TaskPicker({
    suggestions,
    chosenIds,
    onPick,
    onFound,
}: {
    suggestions: ReportTaskOption[];
    chosenIds: Set<string>;
    onPick: (option: ReportTaskOption) => void;
    onFound: (options: ReportTaskOption[]) => void;
}) {
    const id = useId();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ReportTaskOption[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const open = suggestions.filter((option) => !chosenIds.has(option.id));
    const onFoundRef = useRef(onFound);
    onFoundRef.current = onFound;

    useEffect(() => {
        const term = query.trim();

        if (term.length < 2) {
            setResults(null);

            return;
        }

        const abort = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);
            requestJson<{ tasks: ReportTaskOption[] }>(
                `/laporan/tugas?q=${encodeURIComponent(term)}`,
                { signal: abort.signal },
            )
                .then((data) => {
                    setResults(data.tasks);
                    setFailed(false);
                    onFoundRef.current(data.tasks);
                })
                .catch((error: unknown) => {
                    if (
                        !(
                            error instanceof DOMException &&
                            error.name === 'AbortError'
                        )
                    ) {
                        setFailed(true);
                    }
                })
                .finally(() => setLoading(false));
        }, 300);

        return () => {
            window.clearTimeout(timer);
            abort.abort();
        };
    }, [query]);

    const found = (results ?? []).filter((option) => !chosenIds.has(option.id));

    return (
        <div className="flex flex-col gap-3">
            {open.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-[15px] font-bold text-text-muted">
                        Saran: tugas hari ini &amp; yang ditugaskan
                    </p>
                    <ul className="flex flex-col gap-1.5">
                        {open.slice(0, 8).map((option) => (
                            <li key={option.id}>
                                <OptionButton option={option} onPick={onPick} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid gap-2">
                <label
                    htmlFor={id}
                    className="text-[15px] font-bold text-text-muted"
                >
                    Cari tugas lain
                </label>
                <div className="relative">
                    <Search
                        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-subtle"
                        aria-hidden
                    />
                    <Input
                        id={id}
                        type="search"
                        className="pl-10 text-[17px] md:text-[16px]"
                        value={query}
                        placeholder="Judul atau kode, mis. OPS-12"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                {loading && <Skeleton className="h-12 w-full" />}
                {failed && (
                    <p className="text-meta text-danger">
                        Pencarian gagal. Periksa koneksi Anda.
                    </p>
                )}
                {!loading && results !== null && found.length === 0 && (
                    <p className="text-meta text-text-muted">
                        Tidak ada tugas yang cocok.
                    </p>
                )}
                {found.length > 0 && (
                    <ul className="flex flex-col gap-1.5" aria-live="polite">
                        {found.map((option) => (
                            <li key={option.id}>
                                <OptionButton option={option} onPick={onPick} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
