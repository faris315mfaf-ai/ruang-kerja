import { Head } from '@inertiajs/react';

type GuestInfo = {
    status: string;
    status_label: string;
    meeting?: { title: string; starts_at: string; ends_at: string } | null;
};

type Props = {
    /** Secret link token (null when the link is unknown). */
    token: string | null;
    guest: GuestInfo;
};

/**
 * External guest page /tamu/{token} (no account). Contract:
 * docs/sesi/rapat-tamu-eksternal.md. PLACEHOLDER — the web agent builds the
 * real screen (name form, waiting room, pre-join, room); the data it needs is
 * already in these props and in /api/tamu/{token}/*.
 */
export default function Guest({ guest }: Props) {
    return (
        <div className="grid min-h-svh place-items-center bg-page p-6 text-text">
            <Head title="Rapat sebagai tamu" />
            <div className="max-w-md text-center">
                <h1 className="text-h2">{guest.meeting?.title ?? 'Rapat'}</h1>
                <p className="mt-2 text-body text-text-muted">
                    {guest.status_label}
                </p>
            </div>
        </div>
    );
}
