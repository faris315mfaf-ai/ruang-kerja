import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/shell/brand-mark';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/format';

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
        <div className="min-h-svh bg-background px-4 py-6 md:py-10">
            <div className="mx-auto max-w-3xl">
                <Link
                    href="/login"
                    className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-text-muted hover:text-text"
                >
                    <ArrowLeft className="size-4" aria-hidden />
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
            <article className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-5 shadow-card md:p-8">
                <header className="mb-6 space-y-1 border-b border-border pb-4">
                    {!signedIn && <BrandMark withName className="mb-4" />}
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Kebijakan privasi
                    </h1>
                    <p className="text-sm text-text-muted">
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
                    <p className="mt-6 border-t border-border pt-4 text-[13px] text-text-muted">
                        Lihat dan unduh data Anda, atau atur persetujuan lokasi
                        &amp; selfie di{' '}
                        <Link
                            href="/privasi"
                            className="font-medium text-primary hover:underline"
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
