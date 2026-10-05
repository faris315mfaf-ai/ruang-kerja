import type { UploadSessionData } from './types';

/**
 * Browser side of the chunked upload (DriveUploadController): opens a
 * session, sends the file in `chunk_bytes` slices, resumes from the server's
 * `received` after a 409 or a network error, then polls until the queued
 * UploadToDrive job is done. Transport-agnostic so it can be unit tested.
 */

export type ChunkResponse = { status: number; data: UploadSessionData };

export type UploadTransport = {
    start: () => Promise<UploadSessionData>;
    sendChunk: (
        sessionId: string,
        offset: number,
        chunk: Blob,
        onProgress: (loaded: number) => void,
    ) => Promise<ChunkResponse>;
    status: (sessionId: string) => Promise<UploadSessionData>;
    cancel: (sessionId: string) => Promise<void>;
};

export type UploadPhase =
    | 'uploading'
    | 'processing'
    | 'done'
    | 'failed'
    | 'cancelled';

export type UploadProgress = {
    phase: UploadPhase;
    sent: number;
    total: number;
    /** Seconds left while sending, null when unknown. */
    etaSeconds: number | null;
};

export class UploadFailedError extends Error {
    constructor(
        message: string,
        public readonly session: UploadSessionData | null = null,
    ) {
        super(message);
        this.name = 'UploadFailedError';
    }
}

export class UploadCancelledError extends Error {
    constructor() {
        super('Unggahan dibatalkan.');
        this.name = 'UploadCancelledError';
    }
}

type Options = {
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
    /** Network retries per chunk before giving up. */
    retries?: number;
    pollIntervalMs?: number;
    maxPolls?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
};

const defaultSleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

export const PROCESSING_TIMEOUT_MESSAGE =
    'File sudah terkirim dan sedang diproses Google Drive. Muat ulang halaman sebentar lagi.';

/** Remaining seconds from the average speed so far (null for the first second). */
export function estimateSeconds(
    sent: number,
    total: number,
    elapsedMs: number,
): number | null {
    if (sent <= 0 || elapsedMs < 1000) {
        return null;
    }

    const perMs = sent / elapsedMs;

    return Math.max(0, Math.ceil((total - sent) / perMs / 1000));
}

export async function runChunkedUpload(
    file: Blob,
    transport: UploadTransport,
    options: Options = {},
): Promise<UploadSessionData> {
    const {
        onProgress,
        signal,
        retries = 3,
        pollIntervalMs = 1500,
        maxPolls = 400,
        sleep = defaultSleep,
        now = () => Date.now(),
    } = options;
    const total = file.size;
    const startedAt = now();
    const report = (phase: UploadPhase, sent: number) =>
        onProgress?.({
            phase,
            sent,
            total,
            etaSeconds:
                phase === 'uploading'
                    ? estimateSeconds(sent, total, now() - startedAt)
                    : null,
        });

    let session = await transport.start();
    let offset = session.received;
    let failures = 0;

    const abortIfNeeded = async () => {
        if (signal?.aborted) {
            await transport.cancel(session.id).catch(() => undefined);
            report('cancelled', offset);
            throw new UploadCancelledError();
        }
    };

    report('uploading', offset);

    while (offset < total && session.state === 'receiving') {
        await abortIfNeeded();

        const chunk = file.slice(offset, offset + session.chunk_bytes);

        try {
            const response = await transport.sendChunk(
                session.id,
                offset,
                chunk,
                (loaded) => report('uploading', offset + loaded),
            );

            if (response.status >= 400 && response.status !== 409) {
                throw new UploadFailedError(
                    response.data.message ?? 'Gagal mengunggah file.',
                    response.data,
                );
            }

            session = response.data;
            offset = session.received;
            failures = 0;
            report('uploading', offset);
        } catch (error) {
            if (error instanceof UploadFailedError) {
                throw error;
            }

            failures++;

            if (failures > retries) {
                throw new UploadFailedError(
                    'Koneksi terputus saat mengunggah. Coba unggah ulang.',
                    session,
                );
            }

            await sleep(1000 * failures);
            await abortIfNeeded();

            // Ask the server where it is and resume from there.
            session = await transport.status(session.id).catch(() => session);
            offset = session.received;
        }
    }

    if (session.state === 'receiving') {
        throw new UploadFailedError(
            'Unggahan tidak lengkap. Coba unggah ulang.',
            session,
        );
    }

    for (let polls = 0; session.state === 'processing'; polls++) {
        report('processing', total);

        if (polls >= maxPolls) {
            throw new UploadFailedError(PROCESSING_TIMEOUT_MESSAGE, session);
        }

        await sleep(pollIntervalMs);
        session = await transport.status(session.id);
    }

    if (session.state === 'failed') {
        report('failed', total);
        throw new UploadFailedError(
            session.message ?? 'Gagal mengunggah ke Google Drive.',
            session,
        );
    }

    report('done', total);

    return session;
}
