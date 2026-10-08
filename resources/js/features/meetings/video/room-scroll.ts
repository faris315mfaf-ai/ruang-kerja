/**
 * The floating control bar covers the bottom of the minutes paper. The
 * paper reserves that space (padding + `scroll-padding-bottom`, from the
 * CSS variables --room-bar-h / --room-bar-bottom) and a focused field is
 * scrolled above it (audit U-03).
 */

/** Pixels to scroll down so `target` ends above the reserved bottom area (0 = fine). */
export function scrollDeltaAboveBar(
    target: { top: number; bottom: number },
    container: { top: number; bottom: number },
    reserved: number,
): number {
    const limit = container.bottom - reserved;

    if (target.bottom <= limit) {
        return 0;
    }

    // Never push the top of the field out of view.
    return Math.max(
        0,
        Math.min(target.bottom - limit, target.top - container.top),
    );
}

/** onFocus of the scrolling paper: keep the focused field above the bar. */
export function keepFocusAboveBar(event: {
    currentTarget: HTMLElement;
    target: EventTarget | null;
}): void {
    const container = event.currentTarget;
    const target = event.target;

    if (!(target instanceof HTMLElement) || target === container) {
        return;
    }

    const reserved =
        Number.parseFloat(getComputedStyle(container).scrollPaddingBottom) || 0;

    // After the browser's own focus scrolling.
    window.requestAnimationFrame(() => {
        const delta = scrollDeltaAboveBar(
            target.getBoundingClientRect(),
            container.getBoundingClientRect(),
            reserved,
        );

        if (delta > 0) {
            container.scrollBy({ top: delta });
        }
    });
}
