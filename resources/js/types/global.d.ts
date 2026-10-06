import type { AttendanceStatusSummary } from '@/types/attendance';
import type { Auth, Branding, DemoSwitcherAccount } from '@/types/auth';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            branding: Branding;
            auth: Auth;
            /** Sidebar "Persetujuan" badge (requests waiting for the signed-in user). */
            approvals?: { pending: number } | null;
            /** Feature flags (config/features.php). `prototype` = Fase 2 & 3 previews at /pratinjau. */
            features?: { prototype: boolean; chat: boolean };
            /** Obrolan: channels with unread messages; null when the feature is off. */
            chat?: { unread: number } | null;
            /** Local demo only: personas of the account switcher; null elsewhere. */
            demoSwitcher?: DemoSwitcherAccount[] | null;
            /** Sprint 2: once-prop, refreshed every 5 minutes and after a check-in/out. */
            attendanceStatus?: AttendanceStatusSummary | null;
            /** Unread Inbox count (Sprint 8); null for guests. */
            inbox: { unread: number } | null;
            [key: string]: unknown;
        };
    }
}
