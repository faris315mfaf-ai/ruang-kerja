import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RichTextView } from '../editor/rich-text-view';
import type { RichDoc, TaskReferenceInfo } from '../editor/types';
import { LazyRichTextEditor } from './lazy-editor';

type Props = {
    value: RichDoc | null;
    references: Record<string, TaskReferenceInfo>;
    workspaceKey: string;
    editable: boolean;
    onSave: (doc: RichDoc | null) => Promise<boolean>;
    className?: string;
};

/**
 * Description: read-only rich text; "Ubah" (or a click on the text) opens
 * the Tiptap editor. Cmd/Ctrl+Enter saves, Esc cancels.
 */
export function DescriptionField({
    value,
    references,
    workspaceKey,
    editable,
    onSave,
    className,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<RichDoc | null>(value);
    const [saving, setSaving] = useState(false);

    const start = () => {
        setDraft(value);
        setEditing(true);
    };

    const save = async () => {
        setSaving(true);
        const ok = await onSave(draft);
        setSaving(false);

        if (ok) {
            setEditing(false);
        }
    };

    if (editing) {
        return (
            <div
                className={cn('space-y-2', className)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        setEditing(false);
                    }
                }}
            >
                <div className="min-h-32 rounded-lg border border-border-strong bg-surface px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                    <LazyRichTextEditor
                        value={value}
                        workspaceKey={workspaceKey}
                        ariaLabel="Deskripsi tugas"
                        placeholder="Tulis deskripsi… ketik @ untuk menyebut rekan, # untuk merujuk tugas"
                        onChange={setDraft}
                        onSubmit={() => void save()}
                        autoFocus
                        className="min-h-28"
                    />
                </div>
                <div className="flex items-center justify-end gap-2">
                    <span className="mr-auto text-xs text-text-subtle">
                        ⌘ Enter untuk menyimpan · Esc untuk batal
                    </span>
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
                        disabled={saving}
                        onClick={() => void save()}
                    >
                        {saving ? 'Menyimpan…' : 'Simpan'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('group relative', className)}>
            <RichTextView
                doc={value}
                references={references}
                empty={
                    editable ? (
                        <button
                            type="button"
                            onClick={start}
                            className="w-full rounded-md py-1 text-left text-[15px] text-text-subtle hover:text-text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            Tambahkan deskripsi…
                        </button>
                    ) : (
                        <p className="text-[15px] text-text-subtle">
                            Belum ada deskripsi.
                        </p>
                    )
                }
            />
            {editable && value && (
                <button
                    type="button"
                    onClick={start}
                    aria-label="Ubah deskripsi"
                    className="absolute -top-1 right-0 flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-xs text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:opacity-100"
                >
                    <Pencil className="size-3.5" aria-hidden />
                    Ubah
                </button>
            )}
        </div>
    );
}
