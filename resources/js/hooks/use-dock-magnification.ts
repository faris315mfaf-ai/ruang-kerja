import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type DockMagnificationOptions = {
    /** Resting tile size in px. */
    base: number;
    /** Tile size right under the pointer in px. */
    max: number;
    /** Horizontal distance (px) over which the effect falls off to `base`. */
    range: number;
    /** Spring response in seconds (Apple: time to reach the target, not a duration). */
    response?: number;
    /** False on touch/tablet or with reduced motion: tiles stay at `base`. */
    enabled: boolean;
};

type Spring = { value: number; velocity: number };

/** Below this distance and speed a spring is considered settled. */
const REST_DELTA = 0.05;
const REST_SPEED = 0.5;
/** Integration step; longer frames are sub-stepped so a dropped frame never explodes. */
const MAX_STEP = 1 / 120;

/**
 * Size a tile should have for a pointer at `distance` px from its centre:
 * a raised-cosine falloff, smooth at both ends, so neighbours swell gradually
 * like the macOS Dock.
 */
export function magnifiedSize(
    distance: number | null,
    base: number,
    max: number,
    range: number,
): number {
    if (distance === null || Math.abs(distance) >= range) {
        return base;
    }

    const falloff = (1 + Math.cos((Math.PI * distance) / range)) / 2;

    return base + (max - base) * falloff;
}

/**
 * One critically damped spring step (damping ratio 1.0, Apple's default for UI
 * that is not flicked). Semi-implicit Euler with sub-steps keeps it stable at
 * any frame rate.
 */
export function stepSpring(
    spring: Spring,
    target: number,
    dt: number,
    response: number,
): Spring {
    const omega = (2 * Math.PI) / response;
    const stiffness = omega * omega;
    const damping = 2 * omega;
    let { value, velocity } = spring;
    let remaining = Math.min(dt, 0.064);

    while (remaining > 0) {
        const h = Math.min(remaining, MAX_STEP);
        velocity += (-stiffness * (value - target) - damping * velocity) * h;
        value += velocity * h;
        remaining -= h;
    }

    return { value, velocity };
}

/**
 * macOS-style Dock magnification. Every tile follows its own spring towards a
 * size derived from the pointer's distance, always starting from the size on
 * screen, so moving in, out or across the Dock never jumps. Sizes are written
 * straight to the DOM (no React render per frame) and the loop stops once all
 * springs rest.
 */
export function useDockMagnification({
    base,
    max,
    range,
    response = 0.22,
    enabled,
}: DockMagnificationOptions) {
    const tiles = useRef<Map<string, HTMLElement>>(new Map());
    const springs = useRef<Map<string, Spring>>(new Map());
    const pointerX = useRef<number | null>(null);
    const frame = useRef<number | null>(null);
    const last = useRef<number | null>(null);

    const apply = useCallback((element: HTMLElement, size: number) => {
        element.style.setProperty('--dock-size', `${size.toFixed(2)}px`);
    }, []);

    const tick = useCallback(
        (now: number) => {
            const dt =
                last.current === null ? 1 / 60 : (now - last.current) / 1000;
            last.current = now;
            let moving = false;

            // Read every centre before writing any size: interleaving reads and
            // writes would force a layout per tile per frame.
            const centres = new Map<string, number>();

            tiles.current.forEach((element, id) => {
                const rect = element.getBoundingClientRect();
                centres.set(id, rect.left + rect.width / 2);
            });

            tiles.current.forEach((element, id) => {
                const centre = centres.get(id) ?? 0;
                const target = magnifiedSize(
                    pointerX.current === null
                        ? null
                        : pointerX.current - centre,
                    base,
                    max,
                    range,
                );
                const next = stepSpring(
                    springs.current.get(id) ?? { value: base, velocity: 0 },
                    target,
                    dt,
                    response,
                );

                if (
                    Math.abs(next.value - target) < REST_DELTA &&
                    Math.abs(next.velocity) < REST_SPEED
                ) {
                    next.value = target;
                    next.velocity = 0;
                } else {
                    moving = true;
                }

                springs.current.set(id, next);
                apply(element, next.value);
            });

            if (moving || pointerX.current !== null) {
                frame.current = requestAnimationFrame(tick);
            } else {
                frame.current = null;
                last.current = null;
            }
        },
        [apply, base, max, range, response],
    );

    const wake = useCallback(() => {
        if (frame.current === null) {
            last.current = null;
            frame.current = requestAnimationFrame(tick);
        }
    }, [tick]);

    // Stable ref callback per tile: a fresh callback each render would make React
    // detach/attach the ref every time and the tile would lose its spring state.
    const refCallbacks = useRef<
        Map<string, (element: HTMLElement | null) => void>
    >(new Map());

    const register = useCallback(
        (id: string) => {
            let callback = refCallbacks.current.get(id);

            if (!callback) {
                callback = (element: HTMLElement | null) => {
                    if (element) {
                        tiles.current.set(id, element);
                        apply(element, springs.current.get(id)?.value ?? base);
                    } else {
                        tiles.current.delete(id);
                    }
                };
                refCallbacks.current.set(id, callback);
            }

            return callback;
        },
        [apply, base],
    );

    const onPointerMove = useCallback(
        (event: ReactPointerEvent<HTMLElement>) => {
            if (!enabled || event.pointerType === 'touch') {
                return;
            }

            pointerX.current = event.clientX;
            wake();
        },
        [enabled, wake],
    );

    const onPointerLeave = useCallback(() => {
        pointerX.current = null;
        wake();
    }, [wake]);

    // Switching off (tablet, reduced motion) settles every tile back to base.
    useEffect(() => {
        if (!enabled) {
            pointerX.current = null;
            wake();
        }
    }, [enabled, wake]);

    useEffect(
        () => () => {
            if (frame.current !== null) {
                cancelAnimationFrame(frame.current);
            }
        },
        [],
    );

    return { register, onPointerMove, onPointerLeave };
}
