import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { AttachmentsDriveInfo } from '@/features/drive/types';

const requestJson = vi.fn();
vi.mock('@/lib/http', () => ({
    requestJson: (...args: unknown[]) => requestJson(...args),
    xsrfToken: () => null,
    HttpRequestError: class extends Error {},
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-breakpoint', () => ({ useBreakpoint: () => 'desktop' }));
const uploadMany = vi.fn();
vi.mock('@/features/drive/use-drive-uploads', () => ({
    useDriveUploads: () => ({ items: [], uploadMany, dismiss: vi.fn() }),
}));

import type { CommentAttachmentsState } from './comment-attachments';
import {
    PendingAttachmentChips,
    useCommentAttachments,
} from './comment-attachments';

const drive: AttachmentsDriveInfo = {
    enabled: true,
    fake: true,
    picker_enabled: false,
    max_upload_bytes: 100,
    chunk_bytes: 10,
};

let state: CommentAttachmentsState;

function Harness() {
    state = useCommentAttachments(drive);

    return (
        <>
            {state.elements}
            <PendingAttachmentChips
                items={state.pending}
                onRemove={state.remove}
            />
        </>
    );
}

function chooseFiles(files: File[]) {
    const input = screen.getByTestId('attach-upload-input');
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    fireEvent.change(input);
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('useCommentAttachments', () => {
    it('keeps chosen files as chips, rejecting those over the limit', () => {
        render(<Harness />);

        chooseFiles([
            new File(['x'.repeat(10)], 'Nota.pdf', { type: 'application/pdf' }),
            new File(['x'.repeat(200)], 'Video.mp4', { type: 'video/mp4' }),
        ]);

        expect(screen.getByText('Nota.pdf')).toBeTruthy();
        expect(screen.queryByText('Video.mp4')).toBeNull();
        expect(toast.error).toHaveBeenCalledWith(
            expect.stringContaining('Video.mp4 terlalu besar'),
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Batalkan lampiran Nota.pdf' }),
        );
        expect(screen.queryByText('Nota.pdf')).toBeNull();
    });

    it('creates documents and uploads files for the posted comment', async () => {
        requestJson.mockResolvedValue({
            message: 'Google Docs Draf brief dibuat dan dilampirkan.',
            web_view_link: 'https://docs.google.com/document/d/x/edit',
        });
        render(<Harness />);

        chooseFiles([
            new File(['nota'], 'Nota.pdf', { type: 'application/pdf' }),
        ]);
        act(() => state.actions.newDocument('document'));
        fireEvent.change(await screen.findByLabelText('Nama'), {
            target: { value: 'Draf brief' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Tambahkan' }));

        expect(await screen.findByText('Draf brief')).toBeTruthy();

        const changed = vi.fn();
        await act(() => state.flush('01comment', changed));

        expect(requestJson).toHaveBeenCalledWith(
            '/lampiran/comment/01comment/dokumen',
            {
                method: 'POST',
                body: { type: 'document', name: 'Draf brief' },
            },
        );
        expect(uploadMany).toHaveBeenCalledWith(
            [expect.objectContaining({ name: 'Nota.pdf' })],
            expect.objectContaining({
                url: '/lampiran/comment/01comment/unggah',
                maxBytes: 100,
            }),
        );
        expect(changed).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Draf brief')).toBeNull();
    });

    it('does nothing when there is nothing to attach', async () => {
        render(<Harness />);
        const changed = vi.fn();

        await act(() => state.flush('01comment', changed));

        expect(requestJson).not.toHaveBeenCalled();
        expect(changed).not.toHaveBeenCalled();
    });
});
