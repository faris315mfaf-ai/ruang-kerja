import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { BREAKPOINTS, getBreakpoint, useBreakpoint } from './use-breakpoint';
import type { Breakpoint } from './use-breakpoint';

type Listener = (event: MediaQueryListEvent) => void;

/**
 * Minimal matchMedia fake that understands `(min-width: Npx)` /
 * `(max-width: Npx)` and fires `change` only when a query flips.
 */
function installMatchMedia(initialWidth: number) {
    let width = initialWidth;
    const lists: Array<{
        query: string;
        matches: boolean;
        listeners: Set<Listener>;
    }> = [];

    const evaluate = (query: string): boolean => {
        const min = /min-width:\s*(\d+)px/.exec(query);
        const max = /max-width:\s*(\d+)px/.exec(query);

        return (
            (!min || width >= Number(min[1])) &&
            (!max || width <= Number(max[1]))
        );
    };

    window.matchMedia = (query: string): MediaQueryList => {
        const entry = {
            query,
            matches: evaluate(query),
            listeners: new Set<Listener>(),
        };
        lists.push(entry);

        return {
            media: query,
            get matches() {
                return evaluate(query);
            },
            onchange: null,
            addEventListener: (_type: string, listener: Listener) => {
                entry.listeners.add(listener);
            },
            removeEventListener: (_type: string, listener: Listener) => {
                entry.listeners.delete(listener);
            },
            addListener: (listener: Listener) => entry.listeners.add(listener),
            removeListener: (listener: Listener) =>
                entry.listeners.delete(listener),
            dispatchEvent: () => true,
        } as unknown as MediaQueryList;
    };

    return {
        resize(nextWidth: number) {
            width = nextWidth;

            for (const entry of lists) {
                const matches = evaluate(entry.query);

                if (matches !== entry.matches) {
                    entry.matches = matches;

                    for (const listener of entry.listeners) {
                        listener({
                            matches,
                            media: entry.query,
                        } as MediaQueryListEvent);
                    }
                }
            }
        },
        listenerCount() {
            return lists.reduce((sum, e) => sum + e.listeners.size, 0);
        },
    };
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    window.matchMedia = originalMatchMedia;
});

describe('BREAKPOINTS', () => {
    it('matches docs/PLATFORM.md', () => {
        expect(BREAKPOINTS).toEqual({ tablet: 768, desktop: 1024 });
    });
});

describe('getBreakpoint', () => {
    it.each<[number, Breakpoint]>([
        [375, 'mobile'],
        [767, 'mobile'],
        [768, 'tablet'],
        [834, 'tablet'],
        [1023, 'tablet'],
        [1024, 'desktop'],
        [1440, 'desktop'],
    ])('maps %ipx to %s', (width, expected) => {
        installMatchMedia(width);

        expect(getBreakpoint()).toBe(expected);
    });
});

describe('useBreakpoint', () => {
    beforeEach(() => {
        installMatchMedia(1440);
    });

    it('returns the client breakpoint on a client render', () => {
        installMatchMedia(390);

        const { result } = renderHook(() => useBreakpoint());

        expect(result.current).toBe('mobile');
    });

    it('updates when the viewport crosses a breakpoint', () => {
        const media = installMatchMedia(1440);
        const { result } = renderHook(() => useBreakpoint());

        expect(result.current).toBe('desktop');

        act(() => media.resize(900));
        expect(result.current).toBe('tablet');

        act(() => media.resize(390));
        expect(result.current).toBe('mobile');

        act(() => media.resize(1024));
        expect(result.current).toBe('desktop');
    });

    it('removes its listeners on unmount', () => {
        const media = installMatchMedia(1440);
        const { unmount } = renderHook(() => useBreakpoint());

        expect(media.listenerCount()).toBeGreaterThan(0);

        unmount();

        expect(media.listenerCount()).toBe(0);
    });

    it('returns null on the server', () => {
        function Probe() {
            return createElement('span', null, String(useBreakpoint()));
        }

        expect(renderToString(createElement(Probe))).toBe('<span>null</span>');
    });

    it('hydrates with null, then switches to the client breakpoint', async () => {
        installMatchMedia(390);

        const seen: Array<Breakpoint | null> = [];

        function Probe() {
            const breakpoint = useBreakpoint();
            seen.push(breakpoint);

            return createElement('span', null, String(breakpoint));
        }

        const container = document.createElement('div');
        container.innerHTML = '<span>null</span>';
        document.body.appendChild(container);

        const root = await act(async () =>
            hydrateRoot(container, createElement(Probe)),
        );

        expect(seen[0]).toBeNull();
        expect(seen.at(-1)).toBe('mobile');
        expect(container.textContent).toBe('mobile');

        act(() => root.unmount());
    });
});
