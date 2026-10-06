/**
 * Vitest setup (test-only, never bundled into the app).
 *
 * Node >= 25 ships a global Web Storage `localStorage` getter that returns
 * `undefined` unless Node runs with `--localstorage-file`. Vitest's jsdom
 * environment does not override globals that already exist, so
 * `window.localStorage` ends up undefined in tests. Point both storages back
 * at jsdom's real `Storage` instances (keeps `Storage.prototype` spies working).
 */
type JsdomGlobal = { jsdom?: { window?: Window } };

const jsdomWindow = (globalThis as typeof globalThis & JsdomGlobal).jsdom
    ?.window;

if (jsdomWindow) {
    for (const key of ['localStorage', 'sessionStorage'] as const) {
        if (globalThis[key] === undefined) {
            Object.defineProperty(globalThis, key, {
                configurable: true,
                enumerable: true,
                get: () => jsdomWindow[key],
            });
        }
    }
}
