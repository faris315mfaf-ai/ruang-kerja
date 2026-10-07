import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import type { LiveDocument } from '@/features/notes/note-editor';
import { request } from './api';
import type { RoomMinutes } from './types';

/** Without a synced collab server after this long, fall back to autosave. */
const CONNECT_TIMEOUT = 5000;

type Collab = NonNullable<RoomMinutes['collab']>;

export type MinutesCollab =
    | { mode: 'off' }
    | { mode: 'connecting' }
    | { mode: 'live'; live: LiveDocument; connected: boolean };

/**
 * Collaborative minutes (lead decision 7 Okt 2026): when the room props say
 * `features.collab_minutes` and `minutes.collab` = {document, token_url,
 * ws_url}, the minutes text is a Yjs document on the collab server
 * (Hocuspocus, same as Catatan bersama) edited by everyone in the room with
 * carets. Token: POST token_url → {token} (again on every reconnect). Not
 * synced within 5 s → `off`, the room keeps the autosave minutes.
 */
export function useMinutesCollab(
    collab: Collab | null,
    me: { id: string; name: string; seat: number },
): MinutesCollab {
    const [state, setState] = useState<MinutesCollab>(
        collab ? { mode: 'connecting' } : { mode: 'off' },
    );
    const document = collab?.document ?? null;

    useEffect(() => {
        if (!collab) {
            return;
        }

        let cancelled = false;
        const doc = new Y.Doc();
        const token = () =>
            request<{ token: string }>('post', collab.token_url).then(
                (response) => response.token,
            );
        const provider = new HocuspocusProvider({
            url: collab.ws_url,
            name: collab.document,
            document: doc,
            token,
        });
        const off = () => {
            if (!cancelled) {
                cancelled = true;
                provider.destroy();
                setState({ mode: 'off' });
            }
        };
        const timer = window.setTimeout(off, CONNECT_TIMEOUT);

        provider.awareness?.setLocalStateField('user', {
            id: me.id,
            name: me.name,
            tone: me.seat,
        });
        provider.on('synced', () => {
            if (cancelled) {
                return;
            }

            window.clearTimeout(timer);
            setState({
                mode: 'live',
                live: { doc, provider },
                connected: true,
            });
        });
        provider.on('status', ({ status }: { status: string }) => {
            if (!cancelled) {
                setState((current) =>
                    current.mode === 'live'
                        ? { ...current, connected: status === 'connected' }
                        : current,
                );
            }
        });
        provider.on('authenticationFailed', off);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            provider.destroy();
            doc.destroy();
        };
        // One session per document; `me` is stable for the page.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [document]);

    return state;
}
