import { Check, Link2, Monitor } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';

/**
 * Mobile stand-in for desktop-only screens (docs/PLATFORM.md §3): never show a
 * cropped desktop layout on a phone. Offers the link so it can be opened on a
 * computer.
 */
export function DesktopOnlyNotice({ feature }: { feature?: string }) {
    const [, copy] = useClipboard();
    const [copied, setCopied] = useState(false);

    const copyLink = async () => {
        setCopied(await copy(window.location.href));
    };

    return (
        <div
            role="status"
            className="flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-10 text-center"
        >
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Monitor className="size-6" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-[17px] font-semibold text-text">
                Fitur ini tersedia di desktop.
            </p>
            <p className="mt-1 max-w-xs text-[15px] text-text-muted">
                {feature
                    ? `${feature} hanya bisa dibuka dari komputer atau laptop.`
                    : 'Buka halaman ini dari komputer atau laptop.'}
            </p>
            <Button
                type="button"
                variant="outline"
                className="mt-5 min-h-11 text-[15px]"
                onClick={() => void copyLink()}
            >
                {copied ? (
                    <Check className="size-4 text-success" aria-hidden />
                ) : (
                    <Link2 className="size-4" aria-hidden />
                )}
                {copied ? 'Tautan disalin' : 'Salin tautan'}
            </Button>
        </div>
    );
}
