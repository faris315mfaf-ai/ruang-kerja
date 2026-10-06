import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { notesApi } from './api';
import { CURSOR_TONES } from './cursor-tones';
import { toneFor } from './lib';
import type { NotePeer } from './types';

/** Without a synced collab server after this long, the editor saves directly. */
export const COLLAB_CONNECT_TIMEOUT = 5000;

export type CollabMode = 'connecting' | 'live' | 'offline';

export type CollabSession = {
    mode: CollabMode;
    /** Present while `live`. */
    provider: HocuspocusProvider | null;
    doc: Y.Doc | null;
    /** WebSocket currently open (false while reconnecting). */
    connected: boolean;
    /** Other people with the note open (Yjs awareness). */
    peers: NotePeer[];
};

type Me = { id: string; name: string };

function peersOf(provider: HocuspocusProvider, me: Me): NotePeer[] {
    const awareness = provider.awareness;

    if (!awareness) {
        return [];
    }

    const seen = new Set<string>([me.id]);
    const peers: NotePeer[] = [];

    awareness.getStates().forEach((state, clientId) => {
        const user = (state as { user?: Partial<NotePeer> }).user;

        if (
            clientId === awareness.clientID ||
            !user ||
            typeof user.id !== 'string' ||
            seen.has(user.id)
        ) {
            return;
        }

        seen.add(user.id);
        peers.push({
            clientId,
            id: user.id,
            name: typeof user.name === 'string' ? user.name : 'Pengguna',
            tone:
                typeof user.tone === 'number'
                    ? user.tone
                    : toneFor(user.id, CURSOR_TONES.length),
        });
    });

    return peers;
}

/**
 * Live session of a note on the collab server (Hocuspocus): asks Laravel for
 * a short token (again on every reconnect), joins the Yjs document and
 * publishes the viewer in the awareness (name + colour seat). When the
 * server is not configured or not synced within 5 seconds the session falls
 * back to `offline` ("Mode tanpa kolaborasi": the editor saves with PATCH).
 */
export function useCollab({
    noteId,
    enabled,
    me,
}: {
    noteId: string;
    enabled: boolean;
    me: Me;
}): CollabSession {
    const [session, setSession] = useState<CollabSession>({
        mode: enabled ? 'connecting' : 'offline',
        provider: null,
        doc: null,
        connected: false,
        peers: [],
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let cancelled = false;
        let provider: HocuspocusProvider | null = null;
        const doc = new Y.Doc();
        const goOffline = () => {
            if (cancelled) {
                return;
            }

            cancelled = true;
            provider?.destroy();
            setSession({
                mode: 'offline',
                provider: null,
                doc: null,
                connected: false,
                peers: [],
            });
        };
        const timer = window.setTimeout(goOffline, COLLAB_CONNECT_TIMEOUT);

        void notesApi
            .token(noteId)
            .then((first) => {
                if (cancelled) {
                    return;
                }

                let initial: string | null = first.token;
                const current = new HocuspocusProvider({
                    url: first.url,
                    name: noteId,
                    document: doc,
                    // Fresh 2-minute token on every (re)connect.
                    token: async () => {
                        const token =
                            initial ?? (await notesApi.token(noteId)).token;
                        initial = null;

                        return token;
                    },
                });
                provider = current;

                current.awareness?.setLocalStateField('user', {
                    id: me.id,
                    name: me.name,
                    tone: toneFor(me.id, CURSOR_TONES.length),
                });

                const update = () => {
                    if (cancelled) {
                        return;
                    }

                    setSession((state) =>
                        state.mode === 'offline'
                            ? state
                            : { ...state, peers: peersOf(current, me) },
                    );
                };

                current.on('synced', () => {
                    if (cancelled) {
                        return;
                    }

                    window.clearTimeout(timer);
                    setSession({
                        mode: 'live',
                        provider: current,
                        doc,
                        connected: true,
                        peers: peersOf(current, me),
                    });
                });
                current.on('status', ({ status }: { status: string }) => {
                    if (!cancelled) {
                        setSession((state) => ({
                            ...state,
                            connected: status === 'connected',
                        }));
                    }
                });
                current.on('authenticationFailed', goOffline);
                current.awareness?.on('change', update);
            })
            .catch(goOffline);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            provider?.destroy();
            doc.destroy();
        };
        // `me` is the signed-in user, stable for the page.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [noteId, enabled]);

    return session;
}
