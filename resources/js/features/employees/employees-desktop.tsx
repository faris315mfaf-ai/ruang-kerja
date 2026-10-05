import { Link, router, usePage } from '@inertiajs/react';
import { Plus, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { importMethod } from '@/routes/admin/employees';
import { EmployeeFormSheet } from './employee-form-sheet';
import { EmployeeTable } from './employee-table';
import type { StatusTarget } from './status-dialog';
import { StatusDialog } from './status-dialog';
import type {
    EmployeeFormValues,
    EmployeeIndexProps,
    EmployeeRow,
} from './types';

/** Current URL with `edit` set to `id` (or removed when null). */
function urlWithEdit(id: string | null): string {
    const url = new URL(window.location.href);

    if (id === null) {
        url.searchParams.delete('edit');
    } else {
        url.searchParams.set('edit', id);
    }

    return url.pathname + url.search;
}

function editIdFromUrl(url: string): string | null {
    return new URLSearchParams(url.split('?')[1] ?? '').get('edit');
}

/**
 * Admin › Karyawan on desktop/tablet: table + right-hand edit panel. The panel
 * state lives in the URL (`?edit=<id>`) so a refresh reopens it.
 */
export function EmployeesDesktop(props: EmployeeIndexProps) {
    const { url } = usePage();
    const [requestedId, setRequestedId] = useState<string | null>(null);
    const [closing, setClosing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);

    const editId = closing ? null : (requestedId ?? editIdFromUrl(url));
    const mode = creating
        ? ({ type: 'create' } as const)
        : editId
          ? ({ type: 'edit', id: editId } as const)
          : null;

    const openEdit = useCallback((employee: { id: string }) => {
        setCreating(false);
        setRequestedId(employee.id);
        router.get(
            urlWithEdit(employee.id),
            {},
            {
                only: ['editing', 'formOptions'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setRequestedId(null),
            },
        );
    }, []);

    const closePanel = useCallback(() => {
        if (creating) {
            setCreating(false);

            return;
        }

        setClosing(true);
        setRequestedId(null);
        router.get(
            urlWithEdit(null),
            {},
            {
                only: ['editing'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setClosing(false),
            },
        );
    }, [creating]);

    const askDeactivate = useCallback(
        (employee: EmployeeRow | EmployeeFormValues) =>
            setStatusTarget({
                id: employee.id,
                name: employee.name,
                status: employee.status,
                managerName: employee.manager?.name ?? null,
                directReports:
                    'direct_reports_count' in employee
                        ? employee.direct_reports_count
                        : undefined,
            }),
        [],
    );

    return (
        <div className="space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Karyawan
                    </h1>
                    <p className="text-[13px] text-text-muted">
                        <span className="tnum">
                            {formatNumber(props.counts.active)}
                        </span>{' '}
                        aktif ·{' '}
                        <span className="tnum">
                            {formatNumber(props.counts.inactive)}
                        </span>{' '}
                        nonaktif
                        {props.can.manage
                            ? ' · data ini menjadi sumber divisi, tim, atasan, dan alur persetujuan.'
                            : ' · tampilan baca saja.'}
                    </p>
                </div>
                {props.can.manage && (
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={importMethod()}>
                                <Upload />
                                Impor CSV/XLSX
                            </Link>
                        </Button>
                        <Button
                            onClick={() => {
                                setCreating(true);
                            }}
                        >
                            <Plus />
                            Tambah karyawan
                        </Button>
                    </div>
                )}
            </header>

            <EmployeeTable
                employees={props.employees}
                filters={props.filters}
                divisions={props.divisions}
                options={props.options}
                can={props.can}
                selectedId={mode?.type === 'edit' ? mode.id : null}
                onEdit={openEdit}
                onDeactivate={askDeactivate}
                onReactivate={askDeactivate}
            />

            {props.can.manage && (
                <EmployeeFormSheet
                    mode={mode}
                    editing={props.editing}
                    formOptions={props.formOptions}
                    divisions={props.divisions}
                    options={props.options}
                    canAssignSuperAdmin={props.can.assignSuperAdmin}
                    companyDomain={props.companyDomain}
                    onClose={closePanel}
                    onCreated={() => setCreating(false)}
                    onDeactivate={askDeactivate}
                    onReactivate={askDeactivate}
                />
            )}

            <StatusDialog
                target={statusTarget}
                onClose={() => setStatusTarget(null)}
            />
        </div>
    );
}
