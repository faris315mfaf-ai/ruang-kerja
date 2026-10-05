import { Info, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { NotificationMatrix } from '@/features/notifications/settings/matrix';
import {
    DigestCard,
    EmailNote,
    QuietHoursCard,
} from '@/features/notifications/settings/parts';
import { SaveIndicator } from '@/features/notifications/settings/save-indicator';
import type { NotificationSettingsProps } from '@/features/notifications/settings/types';
import type { NotificationSettingsState } from '@/features/notifications/settings/use-notification-settings';

type Props = {
    props: NotificationSettingsProps;
    state: NotificationSettingsState;
    firstName: string;
};

/**
 * Desktop/tablet (SPengaturan): the event × channel table on the left, the
 * daily digest, quiet hours and the test notification on the right.
 */
export function NotificationSettingsDesktop({
    props,
    state,
    firstName,
}: Props) {
    return (
        <div className="flex flex-wrap items-start gap-5">
            <div className="flex min-w-0 flex-[1.4_1_560px] flex-col gap-5">
                <Panel
                    title="Notifikasi"
                    action={<SaveIndicator />}
                    flush
                    className="pb-2"
                >
                    <NotificationMatrix
                        state={state}
                        channels={props.channels}
                        categories={props.categories}
                    />
                    <div className="flex gap-2.5 border-t border-divider px-6 pt-4 pb-2 md:px-7">
                        <Info
                            aria-hidden
                            className="mt-0.5 size-5 shrink-0 text-text-subtle"
                        />
                        <EmailNote email={props.email} />
                    </div>
                </Panel>
            </div>

            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                <DigestCard
                    state={state}
                    props={props}
                    firstName={firstName}
                    variant="desktop"
                />
                <QuietHoursCard state={state} props={props} />
                <Panel title="Uji notifikasi" bodyClassName="gap-3">
                    <p className="text-label font-normal text-text-muted">
                        Kirim satu notifikasi contoh ke Inbox dan email Anda
                        untuk memastikan pengaturan sudah benar.
                    </p>
                    <Button
                        variant="outline"
                        className="self-start"
                        onClick={state.sendTest}
                        disabled={state.sendingTest}
                    >
                        <Send />
                        Kirim notifikasi uji
                    </Button>
                </Panel>
            </div>
        </div>
    );
}
