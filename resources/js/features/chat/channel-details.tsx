import { Link } from '@inertiajs/react';
import { BellOff, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn, focusRing } from '@/lib/utils';
import { AttachmentCard } from './attachment-card';
import { ChannelAvatar, PresenceDot } from './channel-avatar';
import { channelTitle, personById } from './lib';
import { setMuted } from './store';
import type { Channel, ChatState } from './types';

const TYPE_LABEL: Record<Channel['type'], string> = {
    workspace: 'Channel workspace · anggota disinkronkan',
    public: 'Channel publik · semua karyawan bisa bergabung',
    private: 'Channel privat · hanya yang diundang',
    dm: 'Pesan langsung',
    group: 'Grup kecil',
};

const ROLE_LABEL = { owner: 'Pemilik', admin: 'Admin', member: '' } as const;

/** Channel info: topic, notifications (mute), members, shared files. */
export function ChannelDetails({
    channel,
    state,
    onClose,
    className,
}: {
    channel: Channel;
    state: ChatState;
    onClose?: () => void;
    className?: string;
}) {
    const viewer = channel.members.find(
        (member) => member.user_id === state.viewerId,
    );
    const muted = viewer?.muted ?? false;
    const files = state.messages
        .filter(
            (message) =>
                message.channel_id === channel.id && !message.deleted_at,
        )
        .flatMap((message) => message.attachments);
    const online = channel.members.filter(
        (member) => personById(state.people, member.user_id)?.online,
    ).length;

    return (
        <aside
            aria-label="Detail obrolan"
            className={cn('flex min-h-0 flex-col', className)}
        >
            {onClose && (
                <header className="flex items-center gap-2 border-b border-divider px-5 py-3">
                    <h2 className="flex-1 text-[18px] font-bold text-text">
                        Detail
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup detail"
                        className={cn(
                            'flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text',
                            focusRing,
                        )}
                    >
                        <X className="size-5" aria-hidden />
                    </button>
                </header>
            )}
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
                <div className="flex flex-col items-center gap-2 text-center">
                    <ChannelAvatar
                        channel={channel}
                        people={state.people}
                        viewerId={state.viewerId}
                        size="lg"
                    />
                    <p className="text-[20px] leading-7 font-bold text-text">
                        {channelTitle(channel, state.people, state.viewerId)}
                    </p>
                    <p className="text-[14px] text-text-muted">
                        {TYPE_LABEL[channel.type]}
                    </p>
                    {channel.topic && (
                        <p className="text-[15px] leading-[22px] text-text">
                            {channel.topic}
                        </p>
                    )}
                    {channel.workspace && (
                        <Link
                            href={`/w/${channel.workspace.key}`}
                            className={cn(
                                'inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-[15px] font-semibold text-link hover:bg-link-soft',
                                focusRing,
                            )}
                        >
                            Buka workspace {channel.workspace.key}
                            <ExternalLink className="size-4" aria-hidden />
                        </Link>
                    )}
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                    <BellOff
                        aria-hidden
                        className="size-5 shrink-0 text-text-muted"
                    />
                    <label
                        htmlFor={`mute-${channel.id}`}
                        className="flex min-w-0 flex-1 flex-col"
                    >
                        <span className="text-[16px] font-semibold text-text">
                            Bisukan obrolan
                        </span>
                        <span className="text-[14px] text-text-muted">
                            Tetap dapat notifikasi bila Anda disebut
                        </span>
                    </label>
                    <Switch
                        id={`mute-${channel.id}`}
                        size="md"
                        checked={muted}
                        onCheckedChange={(checked) => {
                            setMuted(channel.id, checked);
                            toast.success(
                                checked
                                    ? 'Obrolan dibisukan.'
                                    : 'Notifikasi obrolan aktif lagi.',
                            );
                        }}
                    />
                </div>

                <section aria-labelledby={`members-${channel.id}`}>
                    <h3
                        id={`members-${channel.id}`}
                        className="pb-2 text-[13px] font-bold tracking-[.06em] text-text-muted uppercase"
                    >
                        Anggota · {channel.members.length}{' '}
                        <span className="font-semibold normal-case">
                            ({online} online)
                        </span>
                    </h3>
                    <ul className="flex flex-col">
                        {channel.members.map((member) => {
                            const person = personById(
                                state.people,
                                member.user_id,
                            );

                            if (!person) {
                                return null;
                            }

                            return (
                                <li
                                    key={member.user_id}
                                    className="flex min-h-14 items-center gap-3"
                                >
                                    <span className="relative">
                                        <UserAvatar
                                            name={person.name}
                                            src={person.avatar}
                                            className="size-9 text-[13px]"
                                        />
                                        <PresenceDot
                                            online={person.online}
                                            className="size-2.5"
                                        />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-[15px] font-semibold text-text">
                                            {person.name}
                                            {person.id === state.viewerId &&
                                                ' (Anda)'}
                                        </span>
                                        <span className="truncate text-[13px] text-text-muted">
                                            {person.online
                                                ? 'Online'
                                                : 'Offline'}{' '}
                                            · {person.title}
                                        </span>
                                    </span>
                                    {ROLE_LABEL[member.role] && (
                                        <Badge variant="label">
                                            {ROLE_LABEL[member.role]}
                                        </Badge>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section aria-labelledby={`files-${channel.id}`}>
                    <h3
                        id={`files-${channel.id}`}
                        className="pb-2 text-[13px] font-bold tracking-[.06em] text-text-muted uppercase"
                    >
                        File dibagikan · {files.length}
                    </h3>
                    {files.length === 0 ? (
                        <p className="text-[15px] text-text-muted">
                            Belum ada file di obrolan ini.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {files.map((file, index) => (
                                <AttachmentCard
                                    key={`${file.id}-${index}`}
                                    file={file}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </aside>
    );
}
