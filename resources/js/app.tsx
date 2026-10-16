import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { initializeTheme } from '@/hooks/use-appearance';
import { configureEcho } from '@laravel/echo-react';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

configureEcho({
    broadcaster: 'reverb',
});

const appName = import.meta.env.VITE_APP_NAME || 'RuangKerja';

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            // Full-screen split layout of its own (mockups Login / MLogin).
            case name === 'auth/login':
                return [];
            // Public privacy policy: picks the app shell itself when signed in (Sprint 10).
            case name === 'privacy/policy':
                return [];
            // Lobby kiosk: full screen, no navigation (Sprint 3).
            case name.startsWith('kiosk/'):
                return [];
            // Video RuangKerja pre-join & call: full screen like Google Meet.
            case name === 'meetings/join' ||
                name === 'meetings/room' ||
                // External guest of a video meeting (no account, no shell).
                name === 'meetings/guest':
                return [];
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <>
                {app}
                <Toaster />
            </>
        );
    },
    progress: {
        color: 'var(--primary)',
    },
});

// This will set light / dark mode on load...
initializeTheme();

// PWA: cache only the shell & static assets; data always comes from the network.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js');
    });
}
