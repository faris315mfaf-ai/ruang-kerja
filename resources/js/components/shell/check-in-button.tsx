import { Link, usePage } from '@inertiajs/react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { START_PARAM } from '@/features/attendance/use-attendance-page';
import { shellStatus } from '@/lib/check-in-status';
import { index as attendanceIndex } from '@/routes/attendance';

/**
 * Topbar check-in/check-out button (docs/DESIGN.md §5). Opens the Absensi page
 * with the selfie flow already started.
 */
export function CheckInButton() {
    const { attendanceStatus } = usePage().props;
    const { button } = shellStatus(attendanceStatus);

    if (!button) {
        return null;
    }

    return (
        <Button asChild size="sm" variant={button.variant} className="h-8">
            <Link href={attendanceIndex({ query: { [START_PARAM]: '1' } })}>
                {button.label === 'Check-in' ? (
                    <LogIn aria-hidden />
                ) : (
                    <LogOut aria-hidden />
                )}
                {button.label}
            </Link>
        </Button>
    );
}
