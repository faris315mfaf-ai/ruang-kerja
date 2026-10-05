import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { AttachmentsPayload } from './types';

const requestJson = vi.fn();
vi.mock('@/lib/http', () => ({
    requestJson: (...args: unknown[]) => requestJson(...args),
    xsrfToken: () => null,
    HttpRequestError: class extends Error {},
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/use-breakpoint', () => ({ useBreakpoint: () => 'desktop' }));

import { AttachmentsPanel } from './attachments-panel';

function payload(
    overrides: Partial<AttachmentsPayload> = {},
): AttachmentsPayload {
    return {
        can_edit: true,
        drive: {
            enabled: true,
            fake: false,
            picker_enabled: false,
            max_upload_bytes: 100,
            chunk_bytes: 10,
        },
        attachments: [
            {
                id: 'att-1',
                source: 'drive',
                filename: 'Notulen rapat',
                mime_type: 'application/vnd.google-apps.document',
                size_bytes: null,
                created_at: null,
                uploaded_by: null,
                can_remove: true,
                drive_file: {
                    id: 'file-1',
                    google_file_id: 'g1',
                    name: 'Notulen rapat',
                    mime_type: 'application/vnd.google-apps.document',
                    kind: 'doc',
                    kind_label: 'Google Docs',
                    web_view_link: 'https://docs.google.com/document/d/g1/edit',
                    preview_url: null,
                    icon_link: null,
                    size_bytes: null,
                    owner_email: null,
                    modified_at: null,
                    added_by: null,
                    deleted: false,
                },
            },
        ],
        ...overrides,
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('AttachmentsPanel', () => {
    it('lists the attachments of the parent with the add actions', async () => {
        requestJson.mockResolvedValueOnce(payload());

        render(
            <AttachmentsPanel attachableType="task" attachableId="01task" />,
        );

        expect(await screen.findByText('Notulen rapat')).toBeTruthy();
        expect(requestJson).toHaveBeenCalledWith('/lampiran/task/01task');
        expect(screen.getByRole('button', { name: /Unggah/ })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: /Dokumen baru/ }),
        ).toBeTruthy();
    });

    it('is read-only when the server or the caller says so', async () => {
        requestJson.mockResolvedValueOnce(payload({ can_edit: false }));

        render(
            <AttachmentsPanel attachableType="task" attachableId="01task" />,
        );

        await screen.findByText('Notulen rapat');
        expect(screen.queryByRole('button', { name: /Unggah/ })).toBeNull();

        cleanup();
        requestJson.mockResolvedValueOnce(payload());
        render(
            <AttachmentsPanel
                attachableType="task"
                attachableId="01task"
                canEdit={false}
            />,
        );

        await screen.findByText('Notulen rapat');
        expect(
            screen.queryByRole('button', { name: /Lepas lampiran/ }),
        ).toBeNull();
    });

    it('detaches an attachment and reloads the list', async () => {
        requestJson
            .mockResolvedValueOnce(payload())
            .mockResolvedValueOnce({ message: 'Notulen rapat dilepas.' })
            .mockResolvedValueOnce(payload({ attachments: [] }));

        render(
            <AttachmentsPanel attachableType="task" attachableId="01task" />,
        );

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Lepas lampiran Notulen rapat',
            }),
        );

        await waitFor(() =>
            expect(screen.getByText('Belum ada lampiran.')).toBeTruthy(),
        );
        expect(requestJson).toHaveBeenCalledWith('/lampiran/att-1', {
            method: 'DELETE',
        });
    });

    it('renders data passed by the parent without fetching and follows its updates', async () => {
        const { rerender } = render(
            <AttachmentsPanel
                attachableType="task"
                attachableId="01task"
                initial={payload()}
            />,
        );

        expect(screen.getByText('Notulen rapat')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: /Lampirkan dari Drive/ }),
        ).toBeTruthy();
        expect(requestJson).not.toHaveBeenCalled();

        rerender(
            <AttachmentsPanel
                attachableType="task"
                attachableId="01task"
                initial={payload({ attachments: [] })}
            />,
        );

        expect(await screen.findByText('Belum ada lampiran.')).toBeTruthy();
        expect(requestJson).not.toHaveBeenCalled();
    });

    it('offers Lampirkan + Kamera / Drive / File on phones', () => {
        render(
            <AttachmentsPanel
                attachableType="task"
                attachableId="01task"
                initial={payload()}
                variant="mobile"
            />,
        );

        for (const name of ['Lampirkan', 'Kamera', 'Drive', 'File']) {
            expect(screen.getByRole('button', { name })).toBeTruthy();
        }
    });

    it('hides the controls when Drive is not configured', () => {
        render(
            <AttachmentsPanel
                attachableType="comment"
                attachableId="01comment"
                initial={payload({
                    attachments: [],
                    drive: {
                        enabled: false,
                        fake: false,
                        picker_enabled: false,
                        max_upload_bytes: 100,
                        chunk_bytes: 10,
                    },
                })}
            />,
        );

        expect(
            screen.getByText(
                'Belum ada lampiran. Integrasi Google Drive belum diaktifkan.',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Unggah/ })).toBeNull();
    });

    it('shows an error with a retry', async () => {
        requestJson
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(payload());

        render(
            <AttachmentsPanel attachableType="task" attachableId="01task" />,
        );

        fireEvent.click(
            await screen.findByRole('button', { name: 'Coba lagi' }),
        );

        expect(await screen.findByText('Notulen rapat')).toBeTruthy();
    });
});
