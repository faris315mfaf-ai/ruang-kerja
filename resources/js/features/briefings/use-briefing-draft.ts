import { useCallback, useEffect, useRef, useState } from 'react';
import {
    briefingDraftKey,
    clearBriefingDraft,
    deviceStorage,
    loadBriefingDraft,
    saveBriefingDraft,
} from './draft';
import type { BriefingPeriodValue } from './types';

const DEBOUNCE_MS = 500;

/**
 * Local autosave of the unsent briefing note (per date + period). The text
 * starts from the server content once the note was sent; while unsent, a
 * device draft is restored and every change is persisted (debounced) so the
 * notulensi never disappears on navigation or a closed tab.
 */
export function useBriefingDraft({
    userId,
    date,
    period,
    serverContent,
}: {
    userId: string;
    date: string;
    period: BriefingPeriodValue;
    /** Today's saved note of the period, null while unsent. */
    serverContent: string | null;
}) {
    const key = briefingDraftKey(userId, date, period);
    // Drafts only matter while unsent; once sent the server content wins.
    const [content, setContent] = useState<string>(
        () => serverContent ?? loadBriefingDraft(deviceStorage(), key) ?? '',
    );
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    // The latest text that was persisted, so a failed/aborted save of newer
    // input never reports a stale timestamp.
    const persisted = useRef<string | null>(serverContent);

    useEffect(() => {
        if (serverContent !== null) {
            // Note already sent today: no device draft to keep.
            clearBriefingDraft(deviceStorage(), key);
            setSavedAt(null);
            persisted.current = serverContent;

            return;
        }

        if (content === persisted.current) {
            return;
        }

        const timer = window.setTimeout(() => {
            if (content.trim() === '') {
                clearBriefingDraft(deviceStorage(), key);
                persisted.current = content;
                setSavedAt(null);
            } else if (saveBriefingDraft(deviceStorage(), key, content)) {
                persisted.current = content;
                setSavedAt(new Date());
            }
        }, DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [content, key, serverContent]);

    /** After a successful send: stop keeping a local copy of the note. */
    const clearDraft = useCallback(() => {
        clearBriefingDraft(deviceStorage(), key);
        persisted.current = null;
        setSavedAt(null);
    }, [key]);

    return { content, setContent, draftSavedAt: savedAt, clearDraft };
}
