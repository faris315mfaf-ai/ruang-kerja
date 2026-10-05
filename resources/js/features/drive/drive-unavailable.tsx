import { Link } from '@inertiajs/react';
import { CloudOff } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Google Drive not configured (GoogleFeatures::enabled() false). The Super
 * Admin also sees which env keys are missing (names only).
 */
export function DriveUnavailable({ missing }: { missing: string[] }) {
    return (
        <EmptyState
            icon={CloudOff}
            title="Integrasi Google Drive belum aktif"
            description={
                missing.length > 0
                    ? `Lengkapi ${missing.join(', ')} lalu jalankan php artisan ruangkerja:google-check.`
                    : 'File dan dokumen workspace akan tampil di sini setelah admin RuangKerja menghubungkan Google Drive.'
            }
            action={
                missing.length > 0 ? (
                    <Button asChild variant="outline">
                        <Link href="/settings/google">
                            Pengaturan Akun Google
                        </Link>
                    </Button>
                ) : undefined
            }
        />
    );
}
