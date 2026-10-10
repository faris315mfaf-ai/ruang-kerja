import { describe, expect, it } from 'vitest';
import { shouldShowToolbar, TOOLBAR_IDLE_MS } from './toolbar-visibility';

const T0 = 1_000_000;

describe('shouldShowToolbar', () => {
    it('shows while the editor is focused and the user just interacted', () => {
        expect(shouldShowToolbar(T0, false, true, T0 + 500)).toBe(true);
    });

    it('hides again once the user is idle longer than the window', () => {
        expect(shouldShowToolbar(T0, false, true, T0 + TOOLBAR_IDLE_MS)).toBe(
            false,
        );
        expect(
            shouldShowToolbar(T0, false, true, T0 + TOOLBAR_IDLE_MS - 1),
        ).toBe(true);
    });

    it('keeps the bar while a non-empty selection exists, even when idle', () => {
        expect(shouldShowToolbar(T0, true, true, T0 + 60_000)).toBe(true);
        expect(shouldShowToolbar(null, true, true, T0)).toBe(true);
    });

    it('hides on blur (keyboard closed), selection or not', () => {
        expect(shouldShowToolbar(T0, false, false, T0 + 100)).toBe(false);
        expect(shouldShowToolbar(T0, true, false, T0 + 100)).toBe(false);
    });

    it('hides when focused but nothing ever happened', () => {
        expect(shouldShowToolbar(null, false, true, T0)).toBe(false);
    });

    it('honours a custom idle window', () => {
        expect(shouldShowToolbar(T0, false, true, T0 + 600, 500)).toBe(false);
        expect(shouldShowToolbar(T0, false, true, T0 + 600, 1_000)).toBe(true);
    });
});
