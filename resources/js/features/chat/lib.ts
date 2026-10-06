import type { RichDoc, RichNode } from '@/features/tasks/editor/types';
import { OFFICE_TIMEZONE } from '@/lib/format';
import type {
    Channel,
    ChatPerson,
    ChatTask,
    Message,
    MessageReaction,
} from './types';

/** Same fixed list as App\Models\Reaction::EMOJI. */
export const REACTION_EMOJI = ['👍', '🎉', '❤️', '😄', '👀', '🙏', '✅', '🚀'];

/** Messages from one person within this many minutes share one block. */
export const RUN_GAP_MINUTES = 5;

/** "Today" in every Fase 2 sample: Monday 5 Oct 2026, 10.15 WIB. */
export const PROTOTYPE_BASE = Date.parse('2026-10-05T10:15:00+07:00');

const loadedAt = Date.now();

/** Sample clock: 5 Oct 2026 10.15 WIB plus the time since the page loaded. */
export function prototypeNow(): Date {
    return new Date(PROTOTYPE_BASE + (Date.now() - loadedAt));
}

/** ISO timestamp `days` days from the sample day at "HH:MM" WIB. */
export function sampleTime(days: number, time: string): string {
    const base = new Date(Date.parse(`2026-10-05T${time}:00+07:00`));
    base.setUTCDate(base.getUTCDate() + days);

    return base.toISOString();
}

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const dayLabelFormat = new Intl.DateTimeFormat('id-ID', {
    timeZone: OFFICE_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
});

/** "2026-10-05" in the office timezone. */
export function dayKey(value: string | Date): string {
    return dayKeyFormat.format(new Date(value));
}

function dayNumber(key: string): number {
    const [year, month, day] = key.split('-').map(Number);

    return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** "Hari ini", "Kemarin" or "Jumat, 2 Oktober". */
export function dayLabel(value: string | Date, now: Date): string {
    const diff = dayNumber(dayKey(now)) - dayNumber(dayKey(value));

    if (diff === 0) {
        return 'Hari ini';
    }

    if (diff === 1) {
        return 'Kemarin';
    }

    return dayLabelFormat.format(new Date(value));
}

export type MessageRun = { userId: string; messages: Message[] };
export type DayGroup = { key: string; label: string; runs: MessageRun[] };

/**
 * Groups messages (oldest first) per office day, then into runs of
 * consecutive messages from the same person less than
 * {@link RUN_GAP_MINUTES} apart (one avatar + name per run).
 */
export function groupMessages(messages: Message[], now: Date): DayGroup[] {
    const sorted = [...messages].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
    );
    const groups: DayGroup[] = [];

    for (const message of sorted) {
        const key = dayKey(message.created_at);
        let group = groups.at(-1);

        if (!group || group.key !== key) {
            group = {
                key,
                label: dayLabel(message.created_at, now),
                runs: [],
            };
            groups.push(group);
        }

        const run = group.runs.at(-1);
        const previous = run?.messages.at(-1);
        const gap = previous
            ? (Date.parse(message.created_at) -
                  Date.parse(previous.created_at)) /
              60_000
            : Infinity;

        if (run && run.userId === message.user_id && gap < RUN_GAP_MINUTES) {
            run.messages.push(message);
        } else {
            group.runs.push({ userId: message.user_id, messages: [message] });
        }
    }

    return groups;
}

export type ChannelSection = {
    key: 'workspace' | 'channel' | 'direct';
    label: string;
    channels: Channel[];
};

/** Sidebar sections: Workspace · Channel · Pesan langsung (empty ones dropped). */
export function groupChannels(channels: Channel[]): ChannelSection[] {
    const sections: ChannelSection[] = [
        { key: 'workspace', label: 'Workspace', channels: [] },
        { key: 'channel', label: 'Channel', channels: [] },
        { key: 'direct', label: 'Pesan langsung', channels: [] },
    ];

    for (const channel of channels) {
        if (channel.archived_at) {
            continue;
        }

        const section =
            channel.type === 'workspace'
                ? sections[0]
                : channel.type === 'dm' || channel.type === 'group'
                  ? sections[2]
                  : sections[1];
        section.channels.push(channel);
    }

    return sections.filter((section) => section.channels.length > 0);
}

export function personById(
    people: ChatPerson[],
    id: string,
): ChatPerson | undefined {
    return people.find((person) => person.id === id);
}

/** Members other than the viewer. */
export function otherMembers(
    channel: Channel,
    people: ChatPerson[],
    viewerId: string,
): ChatPerson[] {
    return channel.members
        .filter((member) => member.user_id !== viewerId)
        .map((member) => personById(people, member.user_id))
        .filter((person): person is ChatPerson => person !== undefined);
}

/** Channel name, or the other members' names for DMs and groups. */
export function channelTitle(
    channel: Channel,
    people: ChatPerson[],
    viewerId: string,
): string {
    if (channel.name) {
        return channel.name;
    }

    const names = otherMembers(channel, people, viewerId).map((person) =>
        channel.type === 'group' ? person.name.split(' ')[0] : person.name,
    );

    return names.join(', ') || 'Catatan pribadi';
}

function sortedTopLevel(channelId: string, messages: Message[]): Message[] {
    return messages
        .filter(
            (message) =>
                message.channel_id === channelId && message.parent_id === null,
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function lastMessage(
    channelId: string,
    messages: Message[],
): Message | null {
    return sortedTopLevel(channelId, messages).at(-1) ?? null;
}

function createdAtOf(id: string | null, messages: Message[]): string | null {
    if (!id) {
        return null;
    }

    return messages.find((message) => message.id === id)?.created_at ?? null;
}

/** Top-level messages from others after the viewer's last read message. */
export function unreadCount(
    channel: Channel,
    messages: Message[],
    viewerId: string,
): number {
    const member = channel.members.find((item) => item.user_id === viewerId);
    const readAt = createdAtOf(member?.last_read_message_id ?? null, messages);

    return sortedTopLevel(channel.id, messages).filter(
        (message) =>
            message.user_id !== viewerId &&
            message.deleted_at === null &&
            (readAt === null || message.created_at > readAt),
    ).length;
}

/** Members (not the author) whose last read message is at/after `message`. */
export function readers(
    message: Message,
    channel: Channel,
    messages: Message[],
    people: ChatPerson[],
): ChatPerson[] {
    return channel.members
        .filter((member) => member.user_id !== message.user_id)
        .filter((member) => {
            const readAt = createdAtOf(member.last_read_message_id, messages);

            return readAt !== null && readAt >= message.created_at;
        })
        .map((member) => personById(people, member.user_id))
        .filter((person): person is ChatPerson => person !== undefined);
}

/** "Terkirim", "Dibaca", "Dibaca Sari, Maya", "Dibaca Sari, Maya +3", "Dibaca semua". */
export function receiptLabel(
    readBy: ChatPerson[],
    recipients: number,
    direct: boolean,
): string {
    if (readBy.length === 0) {
        return 'Terkirim';
    }

    if (direct) {
        return 'Dibaca';
    }

    if (recipients > 2 && readBy.length === recipients) {
        return 'Dibaca semua';
    }

    const names = readBy.map((person) => person.name.split(' ')[0]);
    const shown = names.slice(0, 2).join(', ');

    return names.length > 2
        ? `Dibaca ${shown} +${names.length - 2}`
        : `Dibaca ${shown}`;
}

export type ThreadSummary = {
    count: number;
    lastAt: string | null;
    participantIds: string[];
};

export function threadSummary(
    rootId: string,
    messages: Message[],
): ThreadSummary {
    const replies = messages
        .filter(
            (message) =>
                message.parent_id === rootId && message.deleted_at === null,
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

    return {
        count: replies.length,
        lastAt: replies.at(-1)?.created_at ?? null,
        participantIds: [...new Set(replies.map((reply) => reply.user_id))],
    };
}

/** Ids of visible messages whose text contains every word of `query`. */
export function searchMessages(messages: Message[], query: string): string[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        return [];
    }

    return messages
        .filter((message) => message.deleted_at === null)
        .filter((message) => {
            const text = message.body_text.toLowerCase();

            return words.every((word) => text.includes(word));
        })
        .map((message) => message.id);
}

export type Trigger = { char: '@' | '#'; query: string; start: number };

/**
 * "@sar" or "#PLQ-1" right before the caret (start of text or after a
 * space). `start` is the index of the trigger character.
 */
export function findTrigger(text: string, caret: number): Trigger | null {
    const before = text.slice(0, caret);
    const match = /(^|\s)([@#])([^\s@#]{0,30})$/.exec(before);

    if (!match) {
        return null;
    }

    return {
        char: match[2] as '@' | '#',
        query: match[3],
        start: before.length - match[3].length - 1,
    };
}

/** Replaces the trigger + query with `insert` and a trailing space. */
export function applySuggestion(
    text: string,
    trigger: Trigger,
    caret: number,
    insert: string,
): { text: string; caret: number } {
    const next = `${text.slice(0, trigger.start)}${insert} ${text.slice(caret)}`;

    return { text: next, caret: trigger.start + insert.length + 1 };
}

/** People matching the query on any word of their name (viewer excluded). */
export function matchPeople(
    people: ChatPerson[],
    query: string,
    viewerId: string,
): ChatPerson[] {
    const needle = query.toLowerCase();

    return people
        .filter((person) => person.id !== viewerId)
        .filter(
            (person) =>
                needle === '' ||
                person.name
                    .toLowerCase()
                    .split(' ')
                    .some((part) => part.startsWith(needle)),
        )
        .slice(0, 6);
}

export function matchTasks(tasks: ChatTask[], query: string): ChatTask[] {
    const needle = query.toLowerCase();

    return tasks
        .filter(
            (task) =>
                needle === '' ||
                task.key.toLowerCase().includes(needle) ||
                task.title.toLowerCase().includes(needle),
        )
        .slice(0, 6);
}

const TOKEN =
    /(@[A-Z][\p{L}]*(?: [A-Z][\p{L}]*){0,2})|(#?\b[A-Z][A-Z0-9]{1,9}-\d+\b)|(https?:\/\/[^\s]+)/gu;

function lineNodes(
    line: string,
    people: ChatPerson[],
    tasks: ChatTask[],
): RichNode[] {
    const nodes: RichNode[] = [];
    let index = 0;
    const pushText = (text: string) => {
        if (text === '') {
            return;
        }

        const last = nodes.at(-1);

        if (last?.type === 'text' && !last.marks) {
            last.text = `${last.text ?? ''}${text}`;
        } else {
            nodes.push({ type: 'text', text });
        }
    };

    for (const match of line.matchAll(TOKEN)) {
        const [raw, mention, task, url] = match;
        const at = match.index;
        pushText(line.slice(index, at));
        index = at + raw.length;

        if (mention) {
            // Longest full name the "@Words" starts with, else the first name.
            const candidate = mention.slice(1);
            const firstWord = candidate.split(' ')[0];
            const full = [...people]
                .sort((a, b) => b.name.length - a.name.length)
                .find(
                    (item) =>
                        candidate === item.name ||
                        candidate.startsWith(`${item.name} `),
                );
            const person =
                full ??
                people.find((item) => item.name.split(' ')[0] === firstWord);

            if (person) {
                nodes.push({
                    type: 'mention',
                    attrs: { id: person.id, label: person.name },
                });
                pushText(
                    candidate.slice(
                        full ? person.name.length : firstWord.length,
                    ),
                );
            } else {
                pushText(raw);
            }
        } else if (task) {
            const key = task.replace(/^#/, '');
            const info = tasks.find((item) => item.key === key);

            if (info) {
                nodes.push({
                    type: 'taskReference',
                    attrs: { id: info.id, label: info.key },
                });
            } else {
                pushText(raw);
            }
        } else if (url) {
            nodes.push({
                type: 'text',
                text: url,
                marks: [{ type: 'link', attrs: { href: url } }],
            });
        }
    }

    pushText(line.slice(index));

    return nodes;
}

/**
 * Plain composer text → Tiptap JSON (messages.body): one paragraph per line,
 * "@Nama" → mention, "PLQ-18"/"#PLQ-18" → task reference (known tasks only),
 * URLs → links. Returns null for blank text.
 */
export function parseMessage(
    text: string,
    people: ChatPerson[],
    tasks: ChatTask[],
): RichDoc | null {
    const trimmed = text.trim();

    if (trimmed === '') {
        return null;
    }

    return {
        type: 'doc',
        content: trimmed.split('\n').map((line) => {
            const content = lineNodes(line, people, tasks);

            return content.length > 0
                ? { type: 'paragraph', content }
                : { type: 'paragraph' };
        }),
    };
}

/** Adds or removes the viewer's reaction (drops empty groups). */
export function toggleReaction(
    reactions: MessageReaction[],
    emoji: string,
    userId: string,
): MessageReaction[] {
    const existing = reactions.find((reaction) => reaction.emoji === emoji);

    if (!existing) {
        return [...reactions, { emoji, user_ids: [userId] }];
    }

    return reactions
        .map((reaction) =>
            reaction.emoji !== emoji
                ? reaction
                : {
                      ...reaction,
                      user_ids: reaction.user_ids.includes(userId)
                          ? reaction.user_ids.filter((id) => id !== userId)
                          : [...reaction.user_ids, userId],
                  },
        )
        .filter((reaction) => reaction.user_ids.length > 0);
}

/** "Rizky sedang mengetik…", "Rizky dan Sari sedang mengetik…". */
export function typingLabel(names: string[]): string | null {
    const first = names.map((name) => name.split(' ')[0]);

    if (first.length === 0) {
        return null;
    }

    if (first.length === 1) {
        return `${first[0]} sedang mengetik…`;
    }

    if (first.length === 2) {
        return `${first[0]} dan ${first[1]} sedang mengetik…`;
    }

    return `${first.length} orang sedang mengetik…`;
}

/** "PLQ-18" etc. → reference info keyed by task id (RichTextView). */
export function referenceMap(tasks: ChatTask[]): Record<string, ChatTask> {
    return Object.fromEntries(tasks.map((task) => [task.id, task]));
}

/** Short preview for the channel list ("Anda: Siap, …", "📎 Laporan.pdf"). */
export function previewText(
    message: Message | null,
    people: ChatPerson[],
    viewerId: string,
    direct: boolean,
): string {
    if (!message) {
        return 'Belum ada pesan';
    }

    if (message.deleted_at) {
        return 'Pesan dihapus';
    }

    const text =
        message.body_text.trim() !== ''
            ? message.body_text.replace(/\s+/g, ' ')
            : message.attachments[0]
              ? `📎 ${message.attachments[0].name}`
              : '';

    if (message.user_id === viewerId) {
        return `Anda: ${text}`;
    }

    if (direct) {
        return text;
    }

    const author = personById(people, message.user_id);

    return author ? `${author.name.split(' ')[0]}: ${text}` : text;
}

const shortDayFormat = new Intl.DateTimeFormat('id-ID', {
    timeZone: OFFICE_TIMEZONE,
    day: 'numeric',
    month: 'short',
});

const timeFormat = new Intl.DateTimeFormat('id-ID', {
    timeZone: OFFICE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

/** "08.05" in the office timezone. */
export function clockTime(value: string | Date): string {
    const parts = timeFormat.formatToParts(new Date(value));
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '';

    return `${hour}.${minute}`;
}

/** Channel list time: "09.58" today, "Kemarin", else "2 Okt". */
export function listTime(value: string, now: Date): string {
    const label = dayLabel(value, now);

    if (label === 'Hari ini') {
        return clockTime(value);
    }

    if (label === 'Kemarin') {
        return label;
    }

    return shortDayFormat.format(new Date(value));
}

/** Header line: topic; DM = "Ketua Tim Gudang · Online"; group = members. */
export function channelSubtitle(
    channel: Channel,
    people: ChatPerson[],
    viewerId: string,
): string {
    if (channel.type === 'dm') {
        const partner = otherMembers(channel, people, viewerId)[0];

        return partner
            ? `${partner.title} · ${partner.online ? 'Online' : 'Offline'}`
            : 'Catatan pribadi';
    }

    if (channel.type === 'group') {
        const online = otherMembers(channel, people, viewerId).filter(
            (person) => person.online,
        ).length;

        return `${channel.members.length} anggota · ${online} online`;
    }

    return channel.topic ?? `${channel.members.length} anggota`;
}
