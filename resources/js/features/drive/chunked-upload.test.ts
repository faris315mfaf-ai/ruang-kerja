import { describe, expect, it, vi } from 'vite-plus/test';

import {
    estimateSeconds,
    runChunkedUpload,
    UploadCancelledError,
    UploadFailedError,
} from './chunked-upload';
import type { UploadTransport } from './chunked-upload';
import type { UploadSessionData } from './types';

function session(
    overrides: Partial<UploadSessionData> = {},
): UploadSessionData {
    return {
        id: 'up1',
        filename: 'nota.jpg',
        size: 10,
        received: 0,
        state: 'receiving',
        drive_file_id: null,
        attachment_id: null,
        message: null,
        chunk_bytes: 4,
        ...overrides,
    };
}

/** In-memory server that accepts chunks at the right offset. */
function fakeServer(
    size = 10,
    finalState: UploadSessionData['state'] = 'done',
) {
    const state = session({ size });
    const offsets: number[] = [];
    let polls = 0;

    const transport: UploadTransport = {
        start: vi.fn(async () => ({ ...state })),
        sendChunk: vi.fn(async (_id, offset, chunk, onProgress) => {
            offsets.push(offset);

            if (offset !== state.received) {
                return { status: 409, data: { ...state } };
            }

            onProgress(chunk.size);
            state.received += chunk.size;

            if (state.received >= size) {
                state.state = 'processing';
            }

            return { status: 200, data: { ...state } };
        }),
        status: vi.fn(async () => {
            polls++;

            if (state.state === 'processing' && polls >= 2) {
                state.state = finalState;
                state.drive_file_id = finalState === 'done' ? 'file-1' : null;
                state.message =
                    finalState === 'failed' ? 'Drive menolak file.' : null;
            }

            return { ...state };
        }),
        cancel: vi.fn(async () => undefined),
    };

    return { transport, offsets, state };
}

const noSleep = () => Promise.resolve();

describe('runChunkedUpload', () => {
    it('sends the file in chunks and waits until Drive has it', async () => {
        const { transport, offsets } = fakeServer();
        const phases: string[] = [];

        const result = await runChunkedUpload(
            new Blob(['0123456789']),
            transport,
            {
                sleep: noSleep,
                onProgress: (progress) => phases.push(progress.phase),
            },
        );

        expect(offsets).toEqual([0, 4, 8]);
        expect(result.state).toBe('done');
        expect(result.drive_file_id).toBe('file-1');
        expect(phases).toContain('processing');
        expect(phases.at(-1)).toBe('done');
    });

    it('resumes from the server offset after a 409', async () => {
        const { transport, offsets, state } = fakeServer();
        state.received = 4; // e.g. a previous attempt already sent 4 bytes

        vi.mocked(transport.start).mockResolvedValueOnce(
            session({ received: 0 }),
        );

        await runChunkedUpload(new Blob(['0123456789']), transport, {
            sleep: noSleep,
        });

        expect(offsets).toEqual([0, 4, 8]);
    });

    it('retries a chunk after a network error from the acknowledged offset', async () => {
        const { transport, offsets } = fakeServer();
        const send = transport.sendChunk;
        let failed = false;

        transport.sendChunk = vi.fn(
            async (...args: Parameters<UploadTransport['sendChunk']>) => {
                if (!failed && args[1] === 4) {
                    failed = true;
                    throw new TypeError('Failed to fetch');
                }

                return send(...args);
            },
        );

        const result = await runChunkedUpload(
            new Blob(['0123456789']),
            transport,
            { sleep: noSleep },
        );

        expect(result.state).toBe('done');
        expect(offsets).toEqual([0, 4, 8]);
        expect(transport.status).toHaveBeenCalled();
    });

    it('gives up after too many network errors', async () => {
        const { transport } = fakeServer();
        transport.sendChunk = vi.fn(async () => {
            throw new TypeError('offline');
        });

        await expect(
            runChunkedUpload(new Blob(['0123456789']), transport, {
                sleep: noSleep,
                retries: 2,
            }),
        ).rejects.toBeInstanceOf(UploadFailedError);
        expect(transport.sendChunk).toHaveBeenCalledTimes(3);
    });

    it('reports the Indonesian message when Drive rejects the file', async () => {
        const { transport } = fakeServer(10, 'failed');

        await expect(
            runChunkedUpload(new Blob(['0123456789']), transport, {
                sleep: noSleep,
            }),
        ).rejects.toThrow('Drive menolak file.');
    });

    it('cancels the session when aborted', async () => {
        const { transport } = fakeServer();
        const controller = new AbortController();
        controller.abort();

        await expect(
            runChunkedUpload(new Blob(['0123456789']), transport, {
                sleep: noSleep,
                signal: controller.signal,
            }),
        ).rejects.toBeInstanceOf(UploadCancelledError);
        expect(transport.cancel).toHaveBeenCalledWith('up1');
    });
});

describe('estimateSeconds', () => {
    it('extrapolates from the average speed', () => {
        expect(estimateSeconds(0, 100, 5000)).toBeNull();
        expect(estimateSeconds(50, 100, 500)).toBeNull();
        expect(estimateSeconds(25, 100, 1000)).toBe(3);
        expect(estimateSeconds(100, 100, 4000)).toBe(0);
    });
});
