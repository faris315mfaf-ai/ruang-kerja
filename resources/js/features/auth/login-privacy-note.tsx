import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { index as privacy } from '@/routes/privacy';

export function LoginPrivacyNote({ className }: { className?: string }) {
    return (
        <p className={cn('text-sm text-text-muted', className)}>
            Lokasi dan foto selfie hanya dicatat saat Anda check-in atau
            check-out, dan hanya terlihat oleh atasan langsung serta HR.{' '}
            <Link
                href={privacy()}
                className="text-primary underline underline-offset-4 hover:text-primary-hover"
            >
                Kebijakan privasi
            </Link>
        </p>
    );
}
