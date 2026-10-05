import { Head, usePage } from '@inertiajs/react';
import { NotificationSettingsDesktop } from '@/features/notifications/settings/settings.desktop';
import { NotificationSettingsMobile } from '@/features/notifications/settings/settings.mobile';
import { SaveIndicator } from '@/features/notifications/settings/save-indicator';
import type { NotificationSettingsProps } from '@/features/notifications/settings/types';
import { useNotificationSettings } from '@/features/notifications/settings/use-notification-settings';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import SettingsLayout from '@/layouts/settings/layout';

/** Pengaturan › Notifikasi (Sprint 8; design SPengaturan / MSPengaturan). */
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
            <h1 className="sr-only">Pengaturan notifikasi</h1>
            <SettingsLayout>
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
            </SettingsLayout>
        </>
    );
}

NotificationSettingsPage.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: '/settings/profile' },
        { title: 'Notifikasi', href: '/pengaturan/notifikasi' },
    ],
    title: 'Notifikasi',
    back: '/menu',
    appBarActions: <SaveIndicator className="pr-2" />,
};
