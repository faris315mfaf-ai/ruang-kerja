import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fieldClasses, Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hiringUrls } from './lib';
import type { PositionOption } from './types';

/**
 * Position filter + search of the Kandidat tab (query string ?lowongan=&q=,
 * so a reload keeps the view). Search is debounced.
 */
export function CandidateFilters({
    positions,
    filters,
    className,
}: {
    positions: PositionOption[];
    filters: { position: string | null; q: string | null };
    className?: string;
}) {
    const [query, setQuery] = useState(filters.q ?? '');

    const visit = (next: { position: string | null; q: string | null }) => {
        router.get(hiringUrls.index(next), undefined, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['candidates', 'filters', 'truncated'],
        });
    };

    useEffect(() => {
        const q = query.trim() || null;

        // Already the applied search (first render, or after a position change).
        if (q === filters.q) {
            return;
        }

        const timer = window.setTimeout(() => {
            router.get(
                hiringUrls.index({ position: filters.position, q }),
                undefined,
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    only: ['candidates', 'filters', 'truncated'],
                },
            );
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query, filters.q, filters.position]);

    return (
        <div
            className={cn(
                'flex flex-col gap-3 md:flex-row md:items-center',
                className,
            )}
        >
            <label className="sr-only" htmlFor="hiring-position-filter">
                Lowongan
            </label>
            <select
                id="hiring-position-filter"
                value={filters.position ?? ''}
                onChange={(event) =>
                    visit({
                        position: event.target.value || null,
                        q: query.trim() || null,
                    })
                }
                className={cn(fieldClasses, 'h-control md:w-72')}
            >
                <option value="">Semua lowongan</option>
                {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                        {position.title}
                        {position.status === 'closed' ? ' (ditutup)' : ''}
                        {position.status === 'draft' ? ' (draf)' : ''}
                    </option>
                ))}
            </select>
            <div className="relative md:w-80">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-text-subtle"
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama atau email"
                    aria-label="Cari kandidat"
                    className="pl-10"
                />
            </div>
        </div>
    );
}
