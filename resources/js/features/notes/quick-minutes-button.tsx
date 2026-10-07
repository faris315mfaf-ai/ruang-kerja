import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, History, NotebookPen } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { requestJson } from '@/features/tasks/lib/api';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import notesRoutes from '@/routes/notes';
import minutesRoutes from '@/routes/notes/minutes';
import { startOrResumeMinutes } from './minutes-navigation';
import { useMinutesSession } from './minutes-session';
import type { RecentMinutes } from './types';

/** Latest minutes, fetched when the menu opens (dashboards keep their query budget). */
function useRecentMinutes() {
    const [minutes, setMinutes] = useState<RecentMinutes[] | null>(null);
    const [failed, setFailed] = useState(false);

    const load = () => {
        setFailed(false);
        requestJson<{ minutes: RecentMinutes[] }>(minutesRoutes.index())
            .then((response) => setMinutes(response.minutes))
            .catch(() => setFailed(true));
    };

    return { minutes, failed, load };
}

function RecentList({
    state,
    onPick,
    mobile,
}: {
    state: ReturnType<typeof useRecentMinutes>;
    onPick?: () => void;
    mobile: boolean;
}) {
    if (state.failed) {
        return (
            <p className="px-2 py-3 text-[15px] text-text-muted">
                Daftar gagal dimuat.{' '}
                <button
                    type="button"
                    className="font-semibold text-link underline"
                    onClick={state.load}
                >
                    Coba lagi
                </button>
            </p>
        );
    }

    if (state.minutes === null) {
        return (
            <div className="flex flex-col gap-2 p-2" aria-busy>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    if (state.minutes.length === 0) {
        return (
            <p className="px-2 py-3 text-[15px] text-text-muted">
                Belum ada notulensi. Mulai yang pertama dari tombol di atas.
            </p>
        );
    }

    return state.minutes.map((item) =>
        mobile ? (
            <Link
                key={item.id}
                href={notesRoutes.show.url(item.id)}
                onClick={onPick}
                className="flex min-h-14 flex-col justify-center rounded-[14px] px-3 hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
                <span className="truncate text-[17px] font-semibold text-text">
                    {item.title}
                </span>
                <span className="text-[14px] text-text-muted">
                    {[item.workspace_name, formatRelative(item.updated_at)]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
            </Link>
        ) : (
            <DropdownMenuItem key={item.id} asChild>
                <Link
                    href={notesRoutes.show.url(item.id)}
                    className="flex flex-col items-start gap-0"
                >
                    <span className="max-w-full truncate font-semibold">
                        {item.title}
                    </span>
                    <span className="text-[13px] text-text-muted">
                        {[item.workspace_name, formatRelative(item.updated_at)]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </Link>
            </DropdownMenuItem>
        ),
    );
}

/**
 * "Mulai notulensi" (keputusan pemilik 6 Okt 2026) on every dashboard: one
 * tap creates minutes in the personal workspace and opens them in
 * note-taking mode; while minutes are running it becomes "Lanjutkan
 * notulensi". The side menu lists the latest minutes. Hidden while the
 * notes feature is off.
 */
export function QuickMinutesButton({
    mobile = false,
    className,
}: {
    mobile?: boolean;
    className?: string;
}) {
    const { auth, features } = usePage().props;
    const userId = auth.user?.id;
    const running = useMinutesSession(userId);
    const recent = useRecentMinutes();
    const [processing, setProcessing] = useState(false);
    const [sheet, setSheet] = useState(false);

    if (features?.notes !== true) {
        return null;
    }

    const label = running ? 'Lanjutkan notulensi' : 'Mulai notulensi';
    const go = () =>
        startOrResumeMinutes(userId, {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
        });

    if (mobile) {
        return (
            <div className={cn('flex gap-2', className)}>
                <Button
                    size="lg"
                    variant={running ? 'default' : 'tonal'}
                    className="flex-1"
                    disabled={processing}
                    onClick={go}
                >
                    {processing ? <Spinner /> : <NotebookPen aria-hidden />}
                    {label}
                </Button>
                <Button
                    size="icon-lg"
                    variant="outline"
                    aria-label="Notulensi terakhir"
                    onClick={() => {
                        setSheet(true);
                        recent.load();
                    }}
                >
                    <History aria-hidden />
                </Button>
                <BottomSheet
                    open={sheet}
                    onOpenChange={setSheet}
                    title="Notulensi terakhir"
                    description="Tersimpan di Catatan"
                >
                    <div className="flex flex-col gap-1">
                        <RecentList
                            state={recent}
                            mobile
                            onPick={() => setSheet(false)}
                        />
                    </div>
                </BottomSheet>
            </div>
        );
    }

    return (
        <div className={cn('flex items-center', className)}>
            <Button
                variant={running ? 'default' : 'outline'}
                className="rounded-r-none"
                disabled={processing}
                onClick={go}
            >
                {processing ? <Spinner /> : <NotebookPen aria-hidden />}
                {label}
            </Button>
            <DropdownMenu
                onOpenChange={(open) => {
                    if (open) {
                        recent.load();
                    }
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button
                        variant={running ? 'default' : 'outline'}
                        size="icon"
                        className="-ml-px rounded-l-none"
                        aria-label="Notulensi terakhir"
                    >
                        <ChevronDown aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[320px]">
                    <DropdownMenuLabel>Notulensi terakhir</DropdownMenuLabel>
                    <RecentList state={recent} mobile={false} />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href={notesRoutes.index.url()}>Buka Catatan</Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
