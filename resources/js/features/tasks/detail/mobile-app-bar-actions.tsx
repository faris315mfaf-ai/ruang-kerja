import { usePage } from '@inertiajs/react';
import { Share } from 'lucide-react';
import { toast } from 'sonner';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { UserAvatar } from '@/components/shell/user-avatar';
import { presenceLabel, useTaskPresence } from '../realtime/presence';

/** App bar actions of MTaskDetail: who else is viewing + share. */
export function MobileTaskAppBarActions({
    taskId,
    url,
    title,
}: {
    taskId: string;
    url: string;
    title: string;
}) {
    const { auth } = usePage().props;
    const viewers = useTaskPresence(taskId, auth.user?.id);
    const label = presenceLabel(viewers);

    const share = async () => {
        const link = `${window.location.origin}${url}`;

        if (navigator.share) {
            try {
                await navigator.share({ title, url: link });
            } catch {
                // Cancelled.
            }

            return;
        }

        await navigator.clipboard?.writeText(link);
        toast.success('Tautan disalin.');
    };

    return (
        <>
            {viewers[0] && label && (
                <span
                    role="status"
                    aria-label={label}
                    title={label}
                    className="relative flex size-11 items-center justify-center"
                >
                    <UserAvatar
                        name={viewers[0].name}
                        src={viewers[0].avatar}
                        className="size-8 ring-2 ring-success"
                    />
                </span>
            )}
            <button
                type="button"
                onClick={() => void share()}
                aria-label="Bagikan tautan"
                className={appBarIconButton}
            >
                <Share className="size-[22px]" strokeWidth={2} aria-hidden />
            </button>
        </>
    );
}
