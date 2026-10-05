import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/shell/brand-mark';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';

type Props = {
    version: string;
    effective_date: string;
    /** Rendered from resources/markdown/privacy-policy.md (raw HTML escaped). */
    html: string;
    signedIn: boolean;
};

/** Public frame for guests (linked from the login page). */
function PublicFrame({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-svh bg-page px-4 py-6 text-text md:py-10">
            <div className="mx-auto max-w-3xl">
                <Link
                    href="/login"
                    className={cn(
                        'mb-4 inline-flex min-h-control items-center gap-2 rounded-control text-label font-semibold text-link hover:opacity-80',
                        focusRing,
                    )}
                >
                    <ArrowLeft className="size-5" aria-hidden />
                    Kembali ke halaman masuk
                </Link>
                {children}
            </div>
        </div>
    );
}

/**
 * Versioned privacy policy (Sprint 10). Public; signed-in users see it inside
 * the app shell. The text is owner-editable Markdown (config/privacy.php).
 */
export default function PrivacyPolicy({
    version,
    effective_date,
    html,
    signedIn,
}: Props) {
    const content = (
        <>
            <Head title="Kebijakan privasi" />
            <article className="mx-auto max-w-3xl rounded-panel border border-border bg-surface p-6 shadow-card md:p-8">
                <header className="mb-6 flex flex-col gap-1.5 border-b border-divider pb-5">
                    {!signedIn && <BrandMark withName className="mb-4" />}
                    <h1 className="text-h2">Kebijakan privasi</h1>
                    <p className="text-label font-normal text-text-muted">
                        Versi {version} · berlaku sejak{' '}
                        {formatDate(effective_date)}
                    </p>
                </header>
                <div
                    className="policy-prose"
                    // Server-rendered Markdown with raw HTML escaped (PrivacyPolicy::html).
                    dangerouslySetInnerHTML={{ __html: html }}
                />
                {signedIn && (
                    <p className="mt-6 border-t border-divider pt-4 text-label font-normal text-text-muted">
                        Lihat dan unduh data Anda, atau atur persetujuan lokasi
                        &amp; selfie di{' '}
                        <Link
                            href="/privasi"
                            className="font-semibold text-link hover:opacity-80"
                        >
                            Privasi &amp; data saya
                        </Link>
                        .
                    </p>
                )}
            </article>
        </>
    );

    if (!signedIn) {
        return <PublicFrame>{content}</PublicFrame>;
    }

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Pengaturan', href: '/settings/profile' },
                { title: 'Privasi & data saya', href: '/privasi' },
                { title: 'Kebijakan privasi', href: '/kebijakan-privasi' },
            ]}
            title="Kebijakan privasi"
            back="/privasi"
        >
            {content}
        </AppLayout>
    );
}
