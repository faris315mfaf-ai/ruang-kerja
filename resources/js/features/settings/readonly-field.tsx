import type { ReactNode } from 'react';

/**
 * Read-only value in the shape of a field (SPengaturan "Nomor karyawan"):
 * 15/700 label above a 48px box on the page background. Lives in a `<dl>`.
 */
export function ReadonlyField({
    label,
    value,
    hint,
}: {
    label: string;
    value: ReactNode;
    /** Second line under the value (manager e-mail). */
    hint?: ReactNode;
}) {
    const empty = value === null || value === undefined || value === '';

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <dt className="text-label font-bold text-text">{label}</dt>
            <dd className="flex min-h-12 min-w-0 flex-col justify-center rounded-control border border-border bg-background px-3.5 py-2 text-body text-text-muted">
                <span className="break-words">{empty ? '—' : value}</span>
                {hint && !empty && (
                    <span className="truncate text-meta">{hint}</span>
                )}
            </dd>
        </div>
    );
}
