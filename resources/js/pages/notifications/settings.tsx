import { Head, usePage } from '@inertiajs/react';
import { NotificationSettingsDesktop } from '@/features/notifications/settings/settings.desktop';
import { NotificationSettingsMobile } from '@/features/notifications/settings/settings.mobile';
import { SaveIndicator } from '@/features/notifications/settings/save-indicator';
import type { NotificationSettingsProps } from '@/features/notifications/settings/types';
import { useNotificationSettings } from '@/features/notifications/settings/use-notification-settings';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Pengaturan › Notifikasi (Sprint 8). */
export default function NotificationSettingsPage(
    props: NotificationSettingsProps,
) {
    const breakpoint = useBreakpoint();
    const state = useNotificationSettings(props);
    const { auth } = usePage().props;
    const firstName = (auth.user?.name ?? '').split(' ')[0] ?? '';

    return (
        <>
            <Head title="Pengaturan notifikasi" />
            {breakpoint === 'mobile' ? (
                <NotificationSettingsMobile
                    props={props}
                    state={state}
                    firstName={firstName}
                />
            ) : (
                <NotificationSettingsDesktop
                    props={props}
                    state={state}
                    firstName={firstName}
                />
            )}
        </>
    );
}

NotificationSettingsPage.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: '/settings/profile' },
        { title: 'Notifikasi', href: '/pengaturan/notifikasi' },
    ],
    back: '/menu',
    appBarActions: <SaveIndicator className="pr-2 text-xs" />,
};
