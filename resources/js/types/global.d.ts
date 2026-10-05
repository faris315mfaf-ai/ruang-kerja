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
            /** Sprint 2: once-prop, refreshed every 5 minutes and after a check-in/out. */
            attendanceStatus?: AttendanceStatusSummary | null;
            [key: string]: unknown;
        };
    }
}
