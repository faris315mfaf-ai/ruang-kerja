import type { AttendanceStatusSummary } from '@/types/attendance';
import type { Auth, Branding } from '@/types/auth';

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
            sidebarOpen: boolean;
            /** Sidebar "Persetujuan" badge (requests waiting for the signed-in user). */
            approvals?: { pending: number } | null;
            /** Sprint 2: once-prop, refreshed every 5 minutes and after a check-in/out. */
            attendanceStatus?: AttendanceStatusSummary | null;
            /** Unread Inbox count (Sprint 8); null for guests. */
            inbox: { unread: number } | null;
            [key: string]: unknown;
        };
    }
}
