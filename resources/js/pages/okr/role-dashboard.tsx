import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PreviewHeader, usePreviewState } from '@/features/okr/preview-state';
import { ROLE_DASHBOARDS } from '@/features/role-dashboards/fixtures';
import { ROLE_FLOWS } from '@/features/role-dashboards/flows';
import { emptyDashboard, isRoleKey } from '@/features/role-dashboards/lib';
import {
    DashboardError,
    DashboardSkeleton,
} from '@/features/role-dashboards/parts';
import { RoleDashboardDesktop } from '@/features/role-dashboards/role-dashboard.desktop';
import { RoleDashboardMobile } from '@/features/role-dashboards/role-dashboard.mobile';
import { RolePicker } from '@/features/role-dashboards/role-picker';
import type { RoleKey } from '@/features/role-dashboards/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = {
    /** dirut · direktur · hr · corsec · marketing · programming · implementer · analis */
    role: string;
};

/**
 * /peran/{role} — SPKD role dashboard preview (Fase 3, RoleDesk/RolePhone):
 * one data-driven template, a role picker, and the role's primary task flow
 * (P* screen) in a side panel (desktop) or bottom sheet (phone).
 */
export default function RoleDashboardPage({ role: roleProp }: Props) {
    const breakpoint = useBreakpoint();
    const state = usePreviewState();
    const initial: RoleKey = isRoleKey(roleProp) ? roleProp : 'dirut';
    const [role, setRole] = useState<RoleKey>(initial);
    const [flowOpen, setFlowOpen] = useState(false);

    useEffect(() => setRole(initial), [initial]);

    const base = ROLE_DASHBOARDS[role];
    const config = state === 'kosong' ? emptyDashboard(base) : base;
    const mobile = breakpoint === 'mobile';
    const Flow = ROLE_FLOWS[config.flow];

    const switchRole = (next: RoleKey) => {
        setRole(next);
        setFlowOpen(false);
        router.get(
            `/peran/${next}`,
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const secondary = () =>
        toast.info(
            `“${mobile ? config.phone.actions[1] : config.secondaryAction}” tersedia saat modul aktif.`,
        );

    return (
        <>
            <Head title={`Dashboard ${config.label}`} />
            <div className="flex flex-col gap-5">
                <PreviewHeader />
                {breakpoint !== null && (
                    <RolePicker
                        value={role}
                        onChange={switchRole}
                        mobile={mobile}
                    />
                )}
                {breakpoint === null || state === 'memuat' ? (
                    <DashboardSkeleton mobile={mobile} />
                ) : state === 'galat' ? (
                    <DashboardError />
                ) : mobile ? (
                    <RoleDashboardMobile
                        config={config}
                        onOpenFlow={() => setFlowOpen(true)}
                        onSecondary={secondary}
                    />
                ) : (
                    <RoleDashboardDesktop
                        config={config}
                        onOpenFlow={() => setFlowOpen(true)}
                        onSecondary={secondary}
                    />
                )}
            </div>
            {breakpoint !== null && (
                <Flow
                    key={role}
                    open={flowOpen}
                    onOpenChange={setFlowOpen}
                    mobile={mobile}
                />
            )}
        </>
    );
}

RoleDashboardPage.layout = {
    breadcrumbs: [
        { title: 'Pratinjau', href: '/pratinjau' },
        { title: 'Dashboard peran', href: '/peran/dirut' },
    ],
    title: 'Dashboard peran',
    back: '/pratinjau',
};
