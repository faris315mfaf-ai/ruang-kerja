import { describe, expect, it } from 'vitest';
import {
    CHAT_CHANNELS,
    CHAT_MESSAGES,
    CHAT_PEOPLE,
    CHAT_TASKS,
} from './fixtures';
import {
    applySuggestion,
    channelSubtitle,
    channelTitle,
    dayLabel,
    findTrigger,
    groupChannels,
    groupMessages,
    listTime,
    parseMessage,
    readers,
    receiptLabel,
    searchMessages,
    threadSummary,
    toggleReaction,
    typingLabel,
    unreadCount,
} from './lib';
import { slugifyChannelName } from './store';
import { channelNameError } from './new-chat-dialog';
import type { Message } from './types';

const NOW = new Date('2026-10-05T10:15:00+07:00');

function msg(
    id: string,
    user: string,
    at: string,
    extra: Partial<Message> = {},
): Message {
    return {
        id,
        channel_id: 'c',
        user_id: user,
        parent_id: null,
        body: null,
        body_text: id,
        created_at: new Date(at).toISOString(),
        edited_at: null,
        deleted_at: null,
        reactions: [],
        attachments: [],
        ...extra,
    };
}

describe('groupMessages', () => {
    it('groups per office day and per sender run under 5 minutes', () => {
        const groups = groupMessages(
            [
                msg('c', 'u-b', '2026-10-05T08:03:00+07:00'),
                msg('a', 'u-a', '2026-10-05T08:00:00+07:00'),
                msg('b', 'u-a', '2026-10-05T08:02:00+07:00'),
                msg('d', 'u-b', '2026-10-05T08:20:00+07:00'),
                msg('y', 'u-a', '2026-10-04T23:50:00+07:00'),
            ],
            NOW,
        );

        expect(groups.map((group) => group.label)).toEqual([
            'Kemarin',
            'Hari ini',
        ]);
        expect(
            groups[1].runs.map((run) => run.messages.map((m) => m.id)),
        ).toEqual([['a', 'b'], ['c'], ['d']]);
    });

    it('labels older days with the weekday and date', () => {
        expect(dayLabel('2026-10-02T09:00:00+07:00', NOW)).toBe(
            'Jumat, 2 Oktober',
        );
        expect(listTime('2026-10-05T09:58:00+07:00', NOW)).toBe('09.58');
        expect(listTime('2026-10-04T09:58:00+07:00', NOW)).toBe('Kemarin');
    });
});

describe('channels', () => {
    it('sections channels as Workspace, Channel, Pesan langsung', () => {
        expect(
            groupChannels(CHAT_CHANNELS).map((section) => section.label),
        ).toEqual(['Workspace', 'Channel', 'Pesan langsung']);
    });

    it('names DMs and groups after the other members', () => {
        const dm = CHAT_CHANNELS.find((channel) => channel.id === 'dm-sari')!;
        const group = CHAT_CHANNELS.find(
            (channel) => channel.id === 'grp-shift',
        )!;

        expect(channelTitle(dm, CHAT_PEOPLE, 'u-dimas')).toBe('Sari Wulandari');
        expect(channelTitle(group, CHAT_PEOPLE, 'u-dimas')).toBe('Sari, Nadia');
    });

    it('describes the conversation under its title', () => {
        const dm = CHAT_CHANNELS.find((channel) => channel.id === 'dm-sari')!;
        const group = CHAT_CHANNELS.find(
            (channel) => channel.id === 'grp-shift',
        )!;

        expect(channelSubtitle(dm, CHAT_PEOPLE, 'u-dimas')).toBe(
            'Ketua Tim Gudang · Online',
        );
        expect(channelSubtitle(group, CHAT_PEOPLE, 'u-dimas')).toBe(
            '3 anggota · 1 online',
        );
    });

    it('counts unread top-level messages from others, skipping deleted ones', () => {
        const plq = CHAT_CHANNELS.find((channel) => channel.id === 'plq')!;
        const sari = CHAT_CHANNELS.find((channel) => channel.id === 'dm-sari')!;

        expect(unreadCount(plq, CHAT_MESSAGES, 'u-dimas')).toBe(4);
        expect(unreadCount(sari, CHAT_MESSAGES, 'u-dimas')).toBe(1);
    });
});

describe('read receipts', () => {
    it('lists members whose last read message is at or after the message', () => {
        const plq = CHAT_CHANNELS.find((channel) => channel.id === 'plq')!;
        const mine = CHAT_MESSAGES.find((message) => message.id === 'm-plq-2')!;
        const names = readers(mine, plq, CHAT_MESSAGES, CHAT_PEOPLE).map(
            (p) => p.name,
        );

        expect(names).toEqual([
            'Putri Ramadhani',
            'Maya Lestari',
            'Rizky Aditya',
            'Sari Wulandari',
        ]);
        expect(
            receiptLabel(
                readers(mine, plq, CHAT_MESSAGES, CHAT_PEOPLE),
                5,
                false,
            ),
        ).toBe('Dibaca Putri, Maya +2');
    });

    it('says Terkirim, Dibaca and Dibaca semua', () => {
        const sari = CHAT_PEOPLE[1];
        expect(receiptLabel([], 1, true)).toBe('Terkirim');
        expect(receiptLabel([sari], 1, true)).toBe('Dibaca');
        expect(receiptLabel(CHAT_PEOPLE.slice(1, 4), 3, false)).toBe(
            'Dibaca semua',
        );
    });
});

describe('composer', () => {
    it('finds @ and # triggers right before the caret', () => {
        expect(findTrigger('Halo @sa', 8)).toEqual({
            char: '@',
            query: 'sa',
            start: 5,
        });
        expect(findTrigger('lihat #PLQ', 10)).toEqual({
            char: '#',
            query: 'PLQ',
            start: 6,
        });
        expect(findTrigger('email@contoh', 12)).toBeNull();
    });

    it('replaces the trigger with the suggestion and a space', () => {
        const trigger = findTrigger('Halo @sa tolong', 8)!;

        expect(
            applySuggestion('Halo @sa tolong', trigger, 8, '@Sari Wulandari'),
        ).toEqual({
            text: 'Halo @Sari Wulandari  tolong',
            caret: 21,
        });
    });

    it('parses mentions, task references and links into Tiptap JSON', () => {
        const doc = parseMessage(
            '@Sari Wulandari cek #PLQ-18 dan GDG-7, lihat https://contoh.id\nXYZ-1 bukan tugas',
            CHAT_PEOPLE,
            CHAT_TASKS,
        );

        expect(doc?.content?.[0].content).toEqual([
            {
                type: 'mention',
                attrs: { id: 'u-sari', label: 'Sari Wulandari' },
            },
            { type: 'text', text: ' cek ' },
            {
                type: 'taskReference',
                attrs: { id: 't-plq-18', label: 'PLQ-18' },
            },
            { type: 'text', text: ' dan ' },
            { type: 'taskReference', attrs: { id: 't-gdg-7', label: 'GDG-7' } },
            { type: 'text', text: ', lihat ' },
            {
                type: 'text',
                text: 'https://contoh.id',
                marks: [{ type: 'link', attrs: { href: 'https://contoh.id' } }],
            },
        ]);
        expect(doc?.content?.[1].content).toEqual([
            { type: 'text', text: 'XYZ-1 bukan tugas' },
        ]);
        expect(parseMessage('   ', CHAT_PEOPLE, CHAT_TASKS)).toBeNull();
    });

    it('accepts a first-name mention', () => {
        const doc = parseMessage(
            'Terima kasih @Maya!',
            CHAT_PEOPLE,
            CHAT_TASKS,
        );

        expect(doc?.content?.[0].content?.[1]).toEqual({
            type: 'mention',
            attrs: { id: 'u-maya', label: 'Maya Lestari' },
        });
    });
});

describe('reactions, threads, search, typing', () => {
    it('toggles the viewer reaction and drops empty groups', () => {
        const once = toggleReaction(
            [{ emoji: '👍', user_ids: ['a'] }],
            '👍',
            'me',
        );
        expect(once).toEqual([{ emoji: '👍', user_ids: ['a', 'me'] }]);
        expect(
            toggleReaction([{ emoji: '👍', user_ids: ['me'] }], '👍', 'me'),
        ).toEqual([]);
        expect(toggleReaction([], '🚀', 'me')).toEqual([
            { emoji: '🚀', user_ids: ['me'] },
        ]);
    });

    it('summarises a thread', () => {
        expect(threadSummary('m-plq-4', CHAT_MESSAGES)).toEqual({
            count: 3,
            lastAt: new Date('2026-10-05T09:05:00+07:00').toISOString(),
            participantIds: ['u-dimas', 'u-rizky', 'u-maya'],
        });
    });

    it('searches every word, case-insensitively, skipping deleted messages', () => {
        expect(searchMessages(CHAT_MESSAGES, 'VENDOR kursi')).toEqual([
            'm-plq-5',
        ]);
        expect(searchMessages(CHAT_MESSAGES, 'salah kirim')).toEqual([]);
        expect(searchMessages(CHAT_MESSAGES, '  ')).toEqual([]);
    });

    it('describes who is typing', () => {
        expect(typingLabel([])).toBeNull();
        expect(typingLabel(['Rizky Aditya'])).toBe('Rizky sedang mengetik…');
        expect(typingLabel(['Rizky Aditya', 'Sari Wulandari'])).toBe(
            'Rizky dan Sari sedang mengetik…',
        );
    });
});

describe('new channel', () => {
    it('slugs names and rejects too-short ones', () => {
        expect(slugifyChannelName('  Acara Q4 — Panitia! ')).toBe(
            'acara-q4-panitia',
        );
        expect(channelNameError('a')).toBe(
            'Nama channel minimal 2 huruf atau angka.',
        );
        expect(channelNameError('ok')).toBeNull();
    });
});
