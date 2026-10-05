import type { ReactNode } from 'react';
import { cn, focusRing } from '@/lib/utils';

/** Teal 15px text link with a 44px hit area (DLogin footer links). */
export const authLinkClass = cn(
    '-mx-1 inline-flex min-h-control items-center gap-1.5 rounded-sm px-1 text-label font-semibold text-link transition-opacity duration-120 ease-brand hover:opacity-80',
    focusRing,
);

/** Success notice after an auth action ("Tautan … telah dikirim"). */
export function AuthStatus({ children }: { children: ReactNode }) {
    return (
        <p
            role="status"
            className="rounded-lg bg-success-soft px-4 py-3.5 text-label text-success"
        >
            {children}
        </p>
    );
}
