import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { CommentBadge, commentBadgeLabel } from '../comment-badge';
import { ReadReceipt } from './read-receipt';
import type { CommentRead, TaskComment } from './types';

const person = (id: string, name: string) => ({ id, name, avatar: null });
const dimas = person('u-dimas', 'Dimas Pratama');
const rizky = person('u-rizky', 'Rizky Aditya');
const sari = person('u-sari', 'Sari Wulandari');

const comment: TaskComment = {
    kind: 'comment',
    id: '01b',
    task_id: 't',
    author: dimas,
    body: {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [
                    {
                        type: 'mention',
                        attrs: { id: sari.id, label: sari.name },
                    },
                ],
            },
        ],
    },
    body_text: '@Sari',
    created_at: '2026-10-07T09:00:00+00:00',
    edited_at: null,
    deleted: false,
    reactions: [],
    attachments: [],
};

const readBy = (user: typeof dimas): CommentRead => ({
    user,
    last_read_comment_id: '01b',
    last_read_at: '2026-10-07T09:00:00+00:00',
    read_at: '2026-10-07T09:02:00+00:00',
});

afterEach(cleanup);

describe('ReadReceipt', () => {
    it('shows readers and mentioned people who have not read yet', () => {
        render(
            <ReadReceipt
                comment={comment}
                reads={[readBy(rizky), readBy(dimas)]}
                viewerId={dimas.id}
            />,
        );

        expect(screen.getByText('Dibaca oleh 1')).toBeTruthy();
        expect(screen.getByText('Belum dibaca: Sari')).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: /Dibaca oleh Rizky/ })
                .getAttribute('aria-label'),
        ).toBe('Dibaca oleh Rizky. Belum dibaca: Sari. Lihat siapa saja');
    });

    it('opens the list of readers in a sheet on phones', () => {
        render(
            <ReadReceipt
                comment={comment}
                reads={[readBy(rizky)]}
                viewerId={sari.id}
                mobile
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /Dibaca oleh/ }));

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByText('Rizky Aditya')).toBeTruthy();
    });

    it('tells the author when nobody has read their comment and stays empty for others', () => {
        const { rerender } = render(
            <ReadReceipt
                comment={{ ...comment, body: null }}
                reads={[]}
                viewerId={dimas.id}
            />,
        );

        expect(screen.getByText('Belum ada yang membaca')).toBeTruthy();

        rerender(
            <ReadReceipt
                comment={{ ...comment, body: null }}
                reads={[]}
                viewerId={rizky.id}
            />,
        );

        expect(screen.queryByText('Belum ada yang membaca')).toBeNull();
    });
});

describe('CommentBadge', () => {
    it('shows the count with an unread hint for screen readers', () => {
        expect(commentBadgeLabel({ count: 3, unread: true })).toBe(
            '3 komentar, ada komentar baru',
        );

        const { container, rerender } = render(
            <CommentBadge comments={{ count: 2, unread: false }} />,
        );
        expect(screen.getByText('2 komentar')).toBeTruthy();

        rerender(<CommentBadge comments={{ count: 0, unread: false }} />);
        expect(container.textContent).toBe('');

        rerender(<CommentBadge comments={undefined} />);
        expect(container.textContent).toBe('');
    });
});
