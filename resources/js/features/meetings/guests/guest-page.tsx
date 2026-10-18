import { useEffect, useState } from 'react';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { Skeleton } from '@/components/ui/skeleton';
import type { MediaChoices } from '../video/use-video-room';
import { useNow } from '../meetings-context';
import { GuestPreJoin } from './guest-prejoin';
import { GuestRoom } from './guest-room';
import {
    GuestFinal,
    GuestRequestForm,
    GuestShell,
    GuestWaiting,
} from './guest-screens';
import { liveWindowState, screenFor, windowNotice } from './lib';
import type { GuestPageProps } from './types';
import { useGuestSession } from './use-guest-session';

/**
 * /tamu/{token} — the whole external-guest journey in one page: name →
 * waiting room → pre-join → call, plus every end state. The page is a full
 * load without the app shell (resources/js/app.tsx).
 */
export function GuestPage({ token, guest }: GuestPageProps) {
    const breakpoint = useBreakpoint();
    const now = useNow(1000);
    const ctrl = useGuestSession(token, guest);
    const { session } = ctrl;
    const [choices, setChoices] = useState<MediaChoices | null>(null);

    // Anything but "admitted" ends the call (removed, link rotated …).
    useEffect(() => {
        if (session.status !== 'admitted') {
            setChoices(null);
        }
    }, [session.status]);

    if (breakpoint === null) {
        return (
            <GuestShell>
                <div aria-busy className="flex flex-col gap-4">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-64 w-full rounded-panel" />
                </div>
            </GuestShell>
        );
    }

    const screen = screenFor(token ? session.status : 'unknown');

    if (screen === 'admitted') {
        if (choices && token) {
            return (
                <GuestRoom
                    token={token}
                    title={guest.meeting?.title ?? 'Rapat'}
                    choices={choices}
                    onRemoved={ctrl.markRemoved}
                    onCheckAgain={() => void ctrl.checkAgain()}
                />
            );
        }

        return (
            <GuestPreJoin
                info={guest}
                name={ctrl.name}
                mobile={breakpoint === 'mobile'}
                onJoin={setChoices}
            />
        );
    }

    if (screen === 'form') {
        const state = liveWindowState(guest.window, session.window, now);

        return (
            <GuestShell>
                <GuestRequestForm
                    info={guest}
                    name={ctrl.name}
                    onName={ctrl.setName}
                    nameError={ctrl.nameError}
                    formError={ctrl.formError}
                    submitting={ctrl.submitting}
                    onSubmit={() => void ctrl.submit()}
                    notice={windowNotice(guest.window, state, now)}
                    blocked={session.window === 'closed'}
                />
            </GuestShell>
        );
    }

    if (screen === 'waiting') {
        return (
            <GuestShell>
                <GuestWaiting
                    info={guest}
                    name={ctrl.name}
                    offline={ctrl.offline}
                />
            </GuestShell>
        );
    }

    return (
        <GuestShell>
            <GuestFinal
                kind={screen}
                info={guest}
                onCheckAgain={() => void ctrl.checkAgain()}
                checking={ctrl.checking}
            />
        </GuestShell>
    );
}
