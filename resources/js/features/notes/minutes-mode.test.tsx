import { afterEach, describe, expect, it } from 'vite-plus/test';
import { MINUTES_MODE_CLASS, setMinutesModeClass } from './minutes-mode';

describe('setMinutesModeClass', () => {
    afterEach(() => {
        setMinutesModeClass(false);
    });

    it('toggles the tab-bar hiding class on <html>', () => {
        setMinutesModeClass(true);
        expect(
            document.documentElement.classList.contains(MINUTES_MODE_CLASS),
        ).toBe(true);

        setMinutesModeClass(false);
        expect(
            document.documentElement.classList.contains(MINUTES_MODE_CLASS),
        ).toBe(false);
    });

    it('leaves the class alone when asked twice for the same state', () => {
        setMinutesModeClass(true);
        setMinutesModeClass(true);

        expect(
            document.documentElement.classList.contains(MINUTES_MODE_CLASS),
        ).toBe(true);
    });
});
