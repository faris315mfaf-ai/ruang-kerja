import {
    ArrowUp,
    AtSign,
    Bold,
    List,
    ListChecks,
    Paperclip,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AttachMenuItems, AttachSheet } from '@/features/drive/attach-actions';
import type { AttachmentsDriveInfo } from '@/features/drive/types';
import { cn } from '@/lib/utils';
import type { RichTextEditorApi } from '../editor/rich-text-editor';
import type { RichDoc } from '../editor/types';
import {
    PendingAttachmentChips,
    useCommentAttachments,
} from './comment-attachments';
import { LazyRichTextEditor } from './lazy-editor';

type Props = {
    workspaceKey: string;
    author: { name: string; avatar: string | null } | null;
    /** Resolves to the posted comment (its files are attached next) or null. */
    onSubmit: (body: RichDoc) => Promise<{ id: string } | null>;
    /**
     * Drive settings: when enabled the composer offers "Unggah / Pilih dari
     * Drive / Dokumen baru"; the files are attached once the comment exists.
     */
    drive?: AttachmentsDriveInfo | null;
    /** Comment attachments changed (refresh the detail). */
    onAttachmentsChange?: () => void;
    variant?: 'desktop' | 'mobile';
    /** Hint under the box, e.g. "Balasan juga muncul di PLQ-15". */
    hint?: string;
    placeholder?: string;
};

const toolButton =
    'flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * New comment (Tiptap): "@" mentions people with access, "#" references
 * tasks; Cmd/Ctrl+Enter sends. The mobile variant is the sticky bar of
 * mockup MTaskDetail.
 */
export function CommentComposer({
    workspaceKey,
    author,
    onSubmit,
    variant = 'desktop',
    hint,
    placeholder = 'Tulis komentar… ketik @ untuk menyebut rekan',
    drive = null,
    onAttachmentsChange,
}: Props) {
    const [api, setApi] = useState<RichTextEditorApi | null>(null);
    const [empty, setEmpty] = useState(true);
    const [sending, setSending] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const attachments = useCommentAttachments(drive);
    const onReady = useCallback(
        (next: RichTextEditorApi | null) => setApi(next),
        [],
    );

    const send = async () => {
        const body = api?.getJSON() ?? null;

        if (!body || sending) {
            return;
        }

        setSending(true);
        const comment = await onSubmit(body);
        setSending(false);

        if (comment) {
            api?.clear();
            setEmpty(true);
            void attachments.flush(comment.id, () => onAttachmentsChange?.());
        }
    };

    const waiting = attachments.pending.length > 0;
    const chips = (
        <PendingAttachmentChips
            items={attachments.pending}
            onRemove={attachments.remove}
            mobile={variant === 'mobile'}
        />
    );

    const editor = (
        <LazyRichTextEditor
            value={null}
            workspaceKey={workspaceKey}
            ariaLabel="Komentar baru"
            placeholder={
                waiting ? 'Tulis komentar untuk lampiran ini…' : placeholder
            }
            onChange={(doc) => setEmpty(doc === null)}
            onSubmit={() => void send()}
            onReady={onReady}
            className={
                variant === 'mobile' ? 'max-h-32 overflow-y-auto' : 'min-h-16'
            }
        />
    );

    if (variant === 'mobile') {
        return (
            <div className="space-y-2">
                {chips}
                <div className="flex items-end gap-1">
                    <button
                        type="button"
                        onClick={() => api?.startMention()}
                        aria-label="Sebut rekan"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2"
                    >
                        <AtSign className="size-5" aria-hidden />
                    </button>
                    {attachments.enabled && (
                        <button
                            type="button"
                            onClick={() => setSheetOpen(true)}
                            aria-label="Lampirkan file"
                            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2"
                        >
                            <Paperclip className="size-5" aria-hidden />
                        </button>
                    )}
                    <div className="min-h-11 min-w-0 flex-1 rounded-3xl border border-border bg-surface px-4 py-2.5 text-base focus-within:ring-2 focus-within:ring-ring">
                        {editor}
                    </div>
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={empty || sending}
                        aria-label="Kirim komentar"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
                    >
                        <ArrowUp className="size-5" aria-hidden />
                    </button>
                </div>
                {attachments.elements}
                <AttachSheet
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    title="Lampirkan ke komentar"
                    actions={attachments.actions}
                />
            </div>
        );
    }

    return (
        <div className="flex gap-3">
            {author && (
                <UserAvatar
                    name={author.name}
                    src={author.avatar}
                    className="mt-0.5 size-7 text-[10px]"
                />
            )}
            <div className="min-w-0 flex-1">
                <div className="rounded-lg border border-border bg-surface focus-within:border-border-strong focus-within:ring-2 focus-within:ring-ring">
                    <div className="px-3 pt-2.5 pb-1">{editor}</div>
                    {waiting && <div className="px-3 pb-2">{chips}</div>}
                    <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
                        <button
                            type="button"
                            className={toolButton}
                            aria-label="Tebal"
                            onClick={() => api?.toggleBold()}
                        >
                            <Bold className="size-4" aria-hidden />
                        </button>
                        <button
                            type="button"
                            className={toolButton}
                            aria-label="Daftar"
                            onClick={() => api?.toggleBulletList()}
                        >
                            <List className="size-4" aria-hidden />
                        </button>
                        <button
                            type="button"
                            className={toolButton}
                            aria-label="Checklist"
                            onClick={() => api?.toggleTaskList()}
                        >
                            <ListChecks className="size-4" aria-hidden />
                        </button>
                        <button
                            type="button"
                            className={toolButton}
                            aria-label="Sebut rekan"
                            onClick={() => api?.startMention()}
                        >
                            <AtSign className="size-4" aria-hidden />
                        </button>
                        {attachments.enabled && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className={toolButton}
                                        aria-label="Lampirkan file"
                                    >
                                        <Paperclip
                                            className="size-4"
                                            aria-hidden
                                        />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="w-56"
                                >
                                    <AttachMenuItems
                                        actions={attachments.actions}
                                    />
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <kbd className="ml-auto hidden font-mono text-[11px] text-text-subtle sm:inline">
                            ⌘ Enter
                        </kbd>
                        <Button
                            type="button"
                            size="sm"
                            className={cn('ml-2')}
                            disabled={empty || sending}
                            onClick={() => void send()}
                        >
                            {sending ? 'Mengirim…' : 'Kirim'}
                        </Button>
                    </div>
                </div>
                {hint && (
                    <p className="mt-1.5 text-xs text-text-muted">{hint}</p>
                )}
                {attachments.elements}
            </div>
        </div>
    );
}
