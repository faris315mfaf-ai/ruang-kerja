import { Deferred, Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { RoleFlowSheet } from '@/features/role-dashboards/flows';
import {
    DashboardError,
    DashboardSkeleton,
} from '@/features/role-dashboards/parts';
import { RoleDashboardDesktop } from '@/features/role-dashboards/role-dashboard.desktop';
import { RoleDashboardMobile } from '@/features/role-dashboards/role-dashboard.mobile';
import {
    DivisionPicker,
    RolePicker,
} from '@/features/role-dashboards/role-picker';
import type {
    RoleDashboardPageProps,
    RoleKey,
    RoleRow,
} from '@/features/role-dashboards/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { show } from '@/routes/roles';

/**
 * /peran/{role} — Dashboard per jabatan (F3, RoleDesk / RolePhone): one
 * data-driven template per SPKD job, the job picker (Direksi / Super Admin),
 * a division picker for the division jobs and the job's task flow in a side
 * panel (desktop/tablet) or bottom sheet (phone). It complements — never
 * replaces — Dashboard Saya / Divisi / HR, the portfolio and Manajemen.
 */
export default function RoleDashboardPage({
    role,
    roles,
    divisions,
    division,
    dashboard,
    flow,
}: RoleDashboardPageProps) {
    const breakpoint = useBreakpoint();
    const viewerName = usePage().props.auth.user?.name ?? '';
    const [flowOpen, setFlowOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const mobile = breakpoint === 'mobile';

    const switchRole = (next: RoleKey) => {
        setFlowOpen(false);
        setSelectedId(null);
        router.get(show.url({ role: next }), {}, { preserveScroll: true });
    };

    const switchDivision = (next: string) =>
        router.get(
            show.url({ role }),
            { divisi: next },
            { preserveScroll: true, preserveState: true },
        );

    /** Leave review loads the chosen request on demand (`?pilih=`). */
    const select = (id: string) => {
        setSelectedId(id);

        if (flow?.kind === 'leave-review' && flow.selected?.id !== id) {
            router.reload({
                only: ['flow'],
                data: { pilih: id },
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            });
        }
    };

    const openFlow = (row?: RoleRow) => {
        if (!flow) {
            return;
        }

        if (row) {
            select(row.id);
        }

        setFlowOpen(true);
    };

    return (
        <>
            <Head
                title={
                    dashboard
                        ? `Dashboard ${dashboard.label}`
                        : 'Dashboard jabatan'
                }
            />
            <div className="flex flex-col gap-5">
                {breakpoint !== null && (
                    <RolePicker
                        roles={roles}
                        value={role}
                        onChange={switchRole}
                        mobile={mobile}
                    />
                )}
                <DivisionPicker
                    divisions={divisions}
                    value={division}
                    onChange={switchDivision}
                />
                <Deferred
                    data="dashboard"
                    fallback={<DashboardSkeleton mobile={mobile} />}
                    rescue={<DashboardError />}
                >
                    {breakpoint === null || !dashboard ? (
                        <DashboardSkeleton mobile={mobile} />
                    ) : mobile ? (
                        <RoleDashboardMobile
                            config={dashboard}
                            viewerName={viewerName}
                            onOpenFlow={openFlow}
                        />
                    ) : (
                        <RoleDashboardDesktop
                            config={dashboard}
                            viewerName={viewerName}
                            onOpenFlow={openFlow}
                        />
                    )}
                </Deferred>
            </div>
            {breakpoint !== null && flow && (
                <RoleFlowSheet
                    key={role}
                    role={role}
                    flow={flow}
                    open={flowOpen}
                    onOpenChange={setFlowOpen}
                    mobile={mobile}
                    selectedId={selectedId}
                    loading={loading}
                    onSelect={select}
                />
            )}
        </>
    );
}

RoleDashboardPage.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Dashboard jabatan', href: '/peran' },
    ],
    title: 'Dashboard jabatan',
};
