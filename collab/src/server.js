import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import tls from 'node:tls';

/*
 * Catatan bersama — collab server (Hocuspocus + Yjs). Environment:
 *   COLLAB_SECRET   shared with Laravel (required, >= 32 chars)
 *   COLLAB_PORT     listen port (default 1234)
 *   COLLAB_APP_URL  Laravel base URL for the internal endpoints (default APP_URL)
 *   COLLAB_CA_FILE  extra CA (PEM) to trust; Herd's local CA is picked up
 *                   automatically for https://*.test
 * Locally `composer run dev` starts it with the root .env
 * (node --env-file-if-exists=.env collab/src/server.js).
 */

const production = process.env.NODE_ENV === 'production';
const secret = process.env.COLLAB_SECRET ?? '';
const port = Number(process.env.COLLAB_PORT ?? 1234);
const appUrl =
    process.env.COLLAB_APP_URL ||
    process.env.APP_URL ||
    'http://127.0.0.1:8000';

/**
 * In development a missing setup must not stop the other `composer run dev`
 * processes (concurrently --kill-others): explain and stay idle. Notes then
 * work in "Mode tanpa kolaborasi".
 */
function unavailable(message) {
    console.warn(`[collab] ${message}`);

    if (production) {
        process.exit(1);
    }

    console.warn('[collab] Catatan berjalan tanpa kolaborasi (simpan biasa).');
    setInterval(() => {}, 1 << 30);
}

if (secret.length < 32) {
    unavailable('COLLAB_SECRET kosong atau kurang dari 32 karakter.');
} else {
    let modules;

    try {
        modules = await Promise.all([
            import('@hocuspocus/server'),
            import('./laravel.js'),
            import('./notes-extension.js'),
        ]);
    } catch (error) {
        unavailable(
            `Paket server kolaborasi belum terpasang (npm --prefix collab ci): ${error.message}`,
        );
    }

    if (modules) {
        const [{ Server }, { createLaravelClient }, { createNotesExtension }] =
            modules;

        // Local Herd sites (https://*.test) use a self-signed CA Node does not know.
        const herdCa = join(
            homedir(),
            'Library/Application Support/Herd/config/valet/CA/LaravelValetCASelfSigned.pem',
        );
        const caFile =
            process.env.COLLAB_CA_FILE ||
            (/\.test(:\d+)?\/?$/.test(appUrl) && existsSync(herdCa)
                ? herdCa
                : '');

        if (caFile && typeof tls.setDefaultCACertificates === 'function') {
            tls.setDefaultCACertificates([
                ...tls.getCACertificates('default'),
                readFileSync(caFile, 'utf8'),
            ]);
        }

        const server = new Server({
            name: 'ruangkerja-collab',
            port,
            address: '0.0.0.0',
            quiet: true,
            // Store 2 s after the last change, at least every 10 s while typing.
            debounce: 2000,
            maxDebounce: 10000,
            unloadImmediately: false,
            websocketOptions: { maxPayload: 8 * 1024 * 1024 },
            extensions: [
                createNotesExtension({
                    laravel: createLaravelClient({ baseUrl: appUrl, secret }),
                    secret,
                }),
            ],
        });

        await server.listen();
        console.log(`[collab] listening on :${port}, Laravel ${appUrl}`);
    }
}
