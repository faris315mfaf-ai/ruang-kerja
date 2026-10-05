import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationMatrix } from '@/features/notifications/settings/matrix';
import {
    DigestCard,
    EmailNote,
    QuietHoursCard,
} from '@/features/notifications/settings/parts';
import type { NotificationSettingsProps } from '@/features/notifications/settings/types';
import type { NotificationSettingsState } from '@/features/notifications/settings/use-notification-settings';

type Props = {
    props: NotificationSettingsProps;
    state: NotificationSettingsState;
    firstName: string;
};

/**
 * Phone (MSPengaturan): one card per event group under an overline heading,
 * a switch per channel on each row; digest and quiet hours below.
 */
export function NotificationSettingsMobile({ props, state, firstName }: Props) {
    // Channels that are not live yet get one line instead of a column.
    const channels = props.channels.filter((channel) => channel.available);
    const upcoming = props.channels.filter((channel) => !channel.available);

    return (
        <div className="flex flex-col gap-3.5 pb-4">
            {props.categories.map((category) => {
                const hasRows = state.matrix.some(
                    (row) => row.category === category.value,
                );

                if (!hasRows) {
                    return null;
                }

                return (
                    <section
                        key={category.value}
                        aria-labelledby={`notif-${category.value}`}
                        className="flex flex-col gap-2"
                    >
                        <h2
                            id={`notif-${category.value}`}
                            className="px-1 pt-0.5 text-overline text-text-muted"
                        >
                            {category.label}
                        </h2>
                        <div className="overflow-hidden rounded-[22px] border border-border bg-surface">
                            <NotificationMatrix
                                state={state}
                                channels={channels}
                                categories={[category]}
                                showGroupHeadings={false}
                            />
                        </div>
                    </section>
                );
            })}

            <EmailNote email={props.email} className="px-1" />
            {upcoming.length > 0 && (
                <p className="-mt-2 px-1 text-label font-normal text-text-muted">
                    {upcoming.map((channel) => channel.label).join(', ')}{' '}
                    menyusul di Fase 2.
                </p>
            )}

            <DigestCard
                state={state}
                props={props}
                firstName={firstName}
                variant="mobile"
            />
            <QuietHoursCard state={state} props={props} />

            <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={state.sendTest}
                disabled={state.sendingTest}
            >
                <Send />
                Kirim notifikasi uji
            </Button>
        </div>
    );
}
