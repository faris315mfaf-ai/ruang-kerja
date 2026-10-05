import { Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AttachmentsPanel } from '@/features/drive/attachments-panel';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RichTextView } from '../editor/rich-text-view';
import type { RichDoc, TaskReferenceInfo } from '../editor/types';
import { CommentAttachmentList } from './comment-attachments';
import { LazyRichTextEditor } from './lazy-editor';
import { Reactions } from './reactions';
import type { TaskComment } from './types';

type Props = {
    comment: TaskComment;
    viewerId: string | undefined;
    canComment: boolean;
    canModerate: boolean;
    workspaceKey: string;
    taskUrl: string;
    references: Record<string, TaskReferenceInfo>;
    reactions: string[];
    highlighted?: boolean;
    mobile?: boolean;
    onEdit: (body: RichDoc) => Promise<boolean>;
    onDelete: () => void;
    onReact: (emoji: string) => void;
    /** Attachments changed while editing (refresh the detail). */
    onAttachmentsChange?: () => void;
};

/** One comment card: author, time, "(diedit)", menu, body, reactions. */
export function CommentItem({
    comment,
    viewerId,
    canComment,
    canModerate,
    workspaceKey,
    taskUrl,
    references,
    reactions,
    highlighted = false,
    mobile = false,
    onEdit,
    onDelete,
    onReact,
    onAttachmentsChange,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<RichDoc | null>(comment.body);
    const [confirming, setConfirming] = useState(false);
    const mine = comment.author.id === viewerId;
    const canEdit = mine && canComment;
    const canDelete = canComment && (mine || canModerate);

    if (comment.deleted) {
        return (
            <div
                id={`komentar-${comment.id}`}
                className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] text-text-subtle"
            >
                <Trash2 className="size-3.5" aria-hidden />
                Komentar {comment.author.name} dihapus.
            </div>
        );
    }

    const save = async () => {
        if (!draft) {
            return;
        }

        if (await onEdit(draft)) {
            setEditing(false);
        }
    };

    return (
        <article
            id={`komentar-${comment.id}`}
            aria-label={`Komentar ${comment.author.name}`}
            className={cn(
                'flex gap-3',
                highlighted &&
                    'rounded-lg ring-2 ring-primary/50 ring-offset-4 ring-offset-background',
            )}
        >
            {!mobile && (
                <UserAvatar
                    name={comment.author.name}
                    src={comment.author.avatar}
                    className="mt-0.5 size-7 text-[10px]"
                />
            )}
            <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3">
                <header className="flex items-center gap-2">
                    {mobile && (
                        <UserAvatar
                            name={comment.author.name}
                            src={comment.author.avatar}
                            className="size-6 text-[9px]"
                        />
                    )}
                    <span className="truncate text-[13px] font-semibold text-text">
                        {comment.author.name}
                    </span>
                    <time
                        dateTime={comment.created_at}
                        title={formatDateTime(comment.created_at)}
                        className="shrink-0 text-xs text-text-muted"
                    >
                        {formatRelative(comment.created_at)}
                        {comment.edited_at && ' (diedit)'}
                    </time>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Menu komentar"
                                className={cn(
                                    'ml-auto flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    mobile ? '-my-2 -mr-2 size-11' : 'size-7',
                                )}
                            >
                                <MoreHorizontal
                                    className="size-4"
                                    aria-hidden
                                />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                                onSelect={() => {
                                    void navigator.clipboard
                                        ?.writeText(
                                            `${window.location.origin}${taskUrl}#komentar-${comment.id}`,
                                        )
                                        .then(() =>
                                            toast.success(
                                                'Tautan komentar disalin.',
                                            ),
                                        );
                                }}
                            >
                                <Link2 aria-hidden />
                                Salin tautan
                            </DropdownMenuItem>
                            {canEdit && (
                                <DropdownMenuItem
                                    onSelect={() => {
                                        setDraft(comment.body);
                                        setEditing(true);
                                    }}
                                >
                                    <Pencil aria-hidden />
                                    Ubah
                                </DropdownMenuItem>
                            )}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => setConfirming(true)}
                                    >
                                        <Trash2 aria-hidden />
                                        Hapus
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>

                {editing ? (
                    <div
                        className="mt-2 space-y-2"
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.stopPropagation();
                                setEditing(false);
                            }
                        }}
                    >
                        <div className="rounded-md border border-border-strong px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                            <LazyRichTextEditor
                                value={comment.body}
                                workspaceKey={workspaceKey}
                                ariaLabel="Ubah komentar"
                                placeholder="Tulis komentar…"
                                onChange={setDraft}
                                onSubmit={() => void save()}
                                autoFocus
                            />
                        </div>
                        {/* Add/remove files of this comment (author only; the server checks). */}
                        <AttachmentsPanel
                            attachableType="comment"
                            attachableId={comment.id}
                            variant="compact"
                            title="Lampiran komentar"
                            onChange={() => onAttachmentsChange?.()}
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditing(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={!draft}
                                onClick={() => void save()}
                            >
                                Simpan
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <RichTextView
                            doc={comment.body}
                            references={references}
                            className="mt-1.5"
                        />
                        <CommentAttachmentList
                            attachments={comment.attachments}
                            mobile={mobile}
                        />
                    </>
                )}

                {confirming && (
                    <div
                        role="alertdialog"
                        aria-label="Hapus komentar"
                        className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger"
                    >
                        <span className="mr-auto">Hapus komentar ini?</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirming(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                setConfirming(false);
                                onDelete();
                            }}
                        >
                            Hapus
                        </Button>
                    </div>
                )}

                {!editing && (comment.reactions.length > 0 || canComment) && (
                    <div className="mt-2.5">
                        <Reactions
                            groups={comment.reactions}
                            available={reactions}
                            viewerId={viewerId}
                            canReact={canComment}
                            mobile={mobile}
                            onToggle={onReact}
                        />
                    </div>
                )}
            </div>
        </article>
    );
}
