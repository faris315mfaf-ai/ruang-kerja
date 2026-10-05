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
import { formatDate } from '@/lib/format';
import { policy as policyRoute } from '@/routes/privacy';

/**
 * Privasi › Data Saya (Sprint 10, UU PDP): everything the app holds about the
 * signed-in user, downloadable as Excel/PDF, with the location & selfie
 * consent. One responsive layout: the side column (export, consent, profile)
 * comes first on mobile and sits on the right on desktop.
 */
export default function PrivacyIndex(props: PrivacyPageProps) {
    return (
        <>
            <Head title="Privasi & data saya" />
            <div className="mx-auto max-w-6xl space-y-4">
                <header className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="hidden text-xl font-semibold text-text md:block">
                            Privasi &amp; data saya
                        </h1>
                        <p className="max-w-2xl text-[15px] text-text-muted md:mt-1 md:text-sm">
                            Data pribadi Anda yang tersimpan di aplikasi ini.
                            Hanya Anda yang melihat halaman ini.
                        </p>
                    </div>
                    <Link
                        href={policyRoute()}
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline md:min-h-0"
                    >
                        <ShieldCheck className="size-4" aria-hidden />
                        Kebijakan privasi v{props.policy.version} · berlaku{' '}
                        {formatDate(props.policy.effective_date)}
                    </Link>
                </header>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                    <aside
                        aria-label="Unduhan, persetujuan, dan profil"
                        className="space-y-4 lg:col-start-2 lg:row-start-1"
                    >
                        <ExportCard />
                        <ConsentCard consent={props.consent} />
                        <ProfileCard profile={props.profile} />
                    </aside>
                    <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
                        <AttendanceCard
                            attendance={props.attendance}
                            statusLabels={props.statusLabels}
                        />
                        <RequestsCard requests={props.requests} />
                        <DecisionsCard decisions={props.decisions} />
                    </div>
                </div>
            </div>
        </>
    );
}

PrivacyIndex.layout = {
    breadcrumbs: [{ title: 'Privasi & data saya', href: '/privasi' }],
    title: 'Privasi & data saya',
    back: '/menu',
};
