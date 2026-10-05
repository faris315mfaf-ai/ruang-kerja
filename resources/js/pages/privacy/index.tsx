import { Head, Link } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import {
    AttendanceCard,
    ConsentCard,
    DecisionsCard,
    ExportCard,
    ProfileCard,
    RequestsCard,
} from '@/features/privacy/sections';
import type { PrivacyPageProps } from '@/features/privacy/types';
import SettingsLayout from '@/layouts/settings/layout';
import { formatDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { policy as policyRoute } from '@/routes/privacy';

/**
 * Privasi › Data Saya (Sprint 10, UU PDP; design SPengaturan "Data saya &
 * privasi" / MSPengaturan "Privasi"): everything the app holds about the
 * signed-in user, downloadable as Excel/PDF, with the location & selfie
 * consent. The side column (consent, export, profile) comes first on phones
 * and sits on the right from desktop width.
 */
export default function PrivacyIndex(props: PrivacyPageProps) {
    return (
        <>
            <Head title="Privasi & data saya" />
            <h1 className="hidden md:sr-only md:block">
                Privasi &amp; data saya
            </h1>

            <SettingsLayout>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <p className="max-w-2xl text-body text-text-muted">
                        Data pribadi Anda yang tersimpan di aplikasi ini. Hanya
                        Anda yang melihat halaman ini.
                    </p>
                    <Link
                        href={policyRoute()}
                        className={cn(
                            'inline-flex min-h-control items-center gap-2 rounded-control text-label font-semibold text-link hover:opacity-80',
                            focusRing,
                        )}
                    >
                        <ShieldCheck className="size-5" aria-hidden />
                        Kebijakan privasi v{props.policy.version} · berlaku{' '}
                        {formatDate(props.policy.effective_date)}
                    </Link>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
                    <aside
                        aria-label="Persetujuan, unduhan, dan profil"
                        className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-1"
                    >
                        <ConsentCard consent={props.consent} />
                        <ExportCard />
                        <ProfileCard profile={props.profile} />
                    </aside>
                    <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
                        <AttendanceCard
                            attendance={props.attendance}
                            statusLabels={props.statusLabels}
                        />
                        <RequestsCard requests={props.requests} />
                        <DecisionsCard decisions={props.decisions} />
                    </div>
                </div>
            </SettingsLayout>
        </>
    );
}

PrivacyIndex.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: '/settings/profile' },
        { title: 'Privasi & data saya', href: '/privasi' },
    ],
    title: 'Privasi & data saya',
    back: '/menu',
};
