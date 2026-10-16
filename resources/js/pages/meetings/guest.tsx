import { Head } from '@inertiajs/react';
import { GuestPage } from '@/features/meetings/guests/guest-page';
import type { GuestPageProps } from '@/features/meetings/guests/types';

/**
 * External guest page /tamu/{token} (no account, no app shell). Contract:
 * docs/sesi/rapat-tamu-eksternal.md §3. Props come from GuestPortalController
 * (`token` null + `guest.status` "unknown" for a link nobody knows). The
 * page is never indexed and sends no referrer (server headers).
 */
export default function Guest(props: GuestPageProps) {
    return (
        <>
            <Head title="Rapat sebagai tamu">
                <meta name="robots" content="noindex, nofollow" />
                <meta name="referrer" content="no-referrer" />
            </Head>
            <GuestPage {...props} />
        </>
    );
}
