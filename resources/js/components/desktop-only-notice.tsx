import { Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Props = {
    /** Feature name, e.g. "Alur persetujuan". */
    feature?: string;
};

/**
 * Shown instead of desktop-only admin screens on phones (docs/PLATFORM.md §3).
 */
export function DesktopOnlyNotice({ feature }: Props) {
    const copyLink = () => {
        void navigator.clipboard
            ?.writeText(window.location.href)
            .then(() => toast.success('Tautan disalin. Buka di komputer.'))
            .catch(() => toast.error('Tautan gagal disalin.'));
    };

    return (
        <div className="flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-12 text-center shadow-card">
            <Monitor
                aria-hidden
                className="mb-3 size-8 text-text-subtle"
                strokeWidth={1.75}
            />
            <p className="text-[15px] font-semibold text-text">
                Fitur ini tersedia di desktop.
            </p>
            <p className="mt-1 max-w-xs text-sm text-text-muted">
                {feature ? `${feature} ` : 'Halaman ini '}
                perlu layar lebar. Buka RuangKerja di komputer untuk
                melanjutkan.
            </p>
            <Button
                type="button"
                variant="outline"
                className="mt-5 h-11"
                onClick={copyLink}
            >
                Salin tautan
            </Button>
        </div>
    );
}
