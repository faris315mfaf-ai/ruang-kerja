import { Link, usePage } from '@inertiajs/react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shellStatus } from '@/lib/check-in-status';
import { index as attendanceIndex } from '@/routes/attendance';
import { START_PARAM } from '../use-attendance-page';

/**
 * Gradient "Hari ini" strip of Absensi saya (SAbsensi): today's status from
 * the shared attendance summary and the next check-in/out action.
 */
export function TodayBar() {
    const { attendanceStatus } = usePage().props;

    if (!attendanceStatus) {
        return null;
    }

    const shell = shellStatus(attendanceStatus);

    return (
        <section
            aria-label="Absensi hari ini"
            className="flex flex-wrap items-center gap-[18px] rounded-panel bg-primary bg-grad-highlight px-6 py-5 text-on-brand shadow-glow"
        >
            <span
                aria-hidden
                className="flex size-13 shrink-0 items-center justify-center rounded-lg bg-on-brand/18"
            >
                <Clock className="size-[26px]" strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[20px] leading-7 font-extrabold">
                    Hari ini · {shell.title}
                </span>
                <span className="text-[16px]">{shell.detail}</span>
            </span>
            {shell.button && (
                <Button
                    asChild
                    variant="outline"
                    className="h-[50px] rounded-[14px] border-0 bg-on-brand px-6 text-[17px] font-extrabold text-brand-800 hover:bg-on-brand/90"
                >
                    <Link
                        href={attendanceIndex({
                            query: { [START_PARAM]: '1' },
                        })}
                    >
                        {shell.button.label}
                    </Link>
                </Button>
            )}
        </section>
    );
}
