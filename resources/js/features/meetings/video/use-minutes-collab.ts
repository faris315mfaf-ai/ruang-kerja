import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState } from 'react';
import type * as Y from 'yjs';
import type { LiveDocument } from '@/features/notes/note-editor';
import { ApiError } from '@/features/tasks/lib/api';
import { videoApi } from './api';
import type { RoomMinutes } from './types';

/** Without a synced collab server after this long, fall back to autosave. */
const CONNECT_TIMEOUT = 5000;

type Collab = NonNullable<RoomMinutes['collab']>;

export type MinutesCollab =
    | { mode: 'off' }
    | { mode: 'connecting' }
    /** Readers before anyone started the minutes (token 404, audit B-06). */
    | { mode: 'waiting' }
    | {
          mode: 'live';
          live: LiveDocument;
          connected: boolean;
          canEdit: boolean;
      };

/**
 * Collaborative minutes (contract §1.4 `mode: "collab"`, lead decision
 * 7 Okt 2026): the minutes text is the Yjs document `meeting-minutes.{id}`
 * on the collab server of Catatan bersama, edited by everyone invited, with
 * carets. GET token_url → {document, token, url, can_edit} (again on every
 * reconnect). Not synced within 5 s → `off` (the room shows the structured
 * minutes read-only/autosave instead).
 */
export function useMinutesCollab(
    collab: Collab | null,
    me: { id: string; name: string; seat: number },
    /** Changes when the minutes were saved (minutes.updated): retry a 404. */
    retryKey: string | null = null,
): MinutesCollab {
    const [state, setState] = useState<MinutesCollab>(
        collab ? { mode: 'connecting' } : { mode: 'off' },
    );
    const tokenUrl = collab?.token_url ?? null;
    const [attempt, setAttempt] = useState(0);
    const waiting = state.mode === 'waiting';

    // "Notulen belum dimulai": try again once someone saved the minutes.
    useEffect(() => {
        if (waiting) {
            setAttempt((value) => value + 1);
        }
        // Only a new save is a reason to retry.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [retryKey]);

    useEffect(() => {
        if (!tokenUrl) {
            return;
        }

        let cancelled = false;
        let provider: HocuspocusProvider | null = null;
        let doc: Y.Doc | null = null;
        const off = () => {
            if (!cancelled) {
                cancelled = true;
                provider?.destroy();
                setState({ mode: 'off' });
            }
        };
        let timer = window.setTimeout(off, CONNECT_TIMEOUT);

        void videoApi
            .collabToken(tokenUrl)
            // Hocuspocus + Yjs (111 KB) load only once a document exists to
            // join, so rooms without collab minutes never download them
            // (audit U-06). The timer restarts after the load so the chunk
            // download does not eat into the connect budget.
            .then(async (first) => {
                const [{ HocuspocusProvider }, yjs] = await Promise.all([
                    import('@hocuspocus/provider'),
                    import('yjs'),
                ]);

                return { first, HocuspocusProvider, yjs } as const;
            })
            .then(({ first, HocuspocusProvider, yjs }) => {
                if (cancelled) {
                    return;
                }

                const ydoc = new yjs.Doc();
                doc = ydoc;
                window.clearTimeout(timer);
                timer = window.setTimeout(off, CONNECT_TIMEOUT);

                let initial: string | null = first.token;
                // Edit right of the latest token: the server forces a reconnect
                // when it changes (minutes finalized, participant removed or
                // re-admitted), and the editor must follow it — otherwise typing
                // in a read-only connection is silently dropped (audit U-02).
                let canEdit = first.can_edit;
                const current = new HocuspocusProvider({
                    url: first.url || collab?.url || '',
                    name: first.document,
                    document: ydoc,
                    // Fresh short-lived token on every (re)connect.
                    token: async () => {
                        if (initial !== null) {
                            const token = initial;
                            initial = null;

                            return token;
                        }

                        const fresh = await videoApi.collabToken(tokenUrl);
                        canEdit = fresh.can_edit;

                        if (!cancelled) {
                            setState((value) =>
                                value.mode === 'live'
                                    ? { ...value, canEdit }
                                    : value,
                            );
                        }

                        return fresh.token;
                    },
                });
                provider = current;
                current.awareness?.setLocalStateField('user', {
                    id: me.id,
                    name: me.name,
                    tone: me.seat,
                });
                current.on('synced', () => {
                    if (cancelled) {
                        return;
                    }

                    window.clearTimeout(timer);
                    setState({
                        mode: 'live',
                        live: { doc: ydoc, provider: current },
                        connected: true,
                        canEdit,
                    });
                });
                current.on('status', ({ status }: { status: string }) => {
                    if (!cancelled) {
                        setState((value) =>
                            value.mode === 'live'
                                ? {
                                      ...value,
                                      connected: status === 'connected',
                                  }
                                : value,
                        );
                    }
                });
                current.on('authenticationFailed', off);
            })
            .catch((error: unknown) => {
                if (error instanceof ApiError && error.status === 404) {
                    window.clearTimeout(timer);
                    cancelled = true;
                    setState({ mode: 'waiting' });

                    return;
                }

                off();
            });

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            provider?.destroy();
            doc?.destroy();
        };
        // One session per document; `me` is stable for the page.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenUrl, attempt]);

    return state;
}
