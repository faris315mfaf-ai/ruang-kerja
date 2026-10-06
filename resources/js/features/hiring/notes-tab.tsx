import { router, useForm } from '@inertiajs/react';
import { NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { UserAvatar } from '@/components/shell/user-avatar';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { hiringUrls } from './lib';
import type { CandidateProfileProps, NoteEntry } from './types';

function NoteItem({ note }: { note: NoteEntry }) {
    const [editing, setEditing] = useState(false);
    const form = useForm({ body: note.body });

    return (
        <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
            <UserAvatar
                name={note.author?.name ?? 'Mantan karyawan'}
                src={note.author?.avatar}
                className="size-9"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="flex flex-wrap items-baseline gap-x-2 text-meta text-text-muted">
                    <span className="text-[15px] font-semibold text-text">
                        {note.author?.name ?? 'Mantan karyawan'}
                    </span>
                    {formatDateTime(note.created_at)}
                    {note.edited_at && <span>· diubah</span>}
                </p>
                {editing ? (
                    <form
                        className="flex flex-col gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.patch(hiringUrls.note(note.id), {
                                preserveScroll: true,
                                onSuccess: () => setEditing(false),
                            });
                        }}
                    >
                        <Label
                            htmlFor={`note-edit-${note.id}`}
                            className="sr-only"
                        >
                            Ubah notulensi
                        </Label>
                        <Textarea
                            id={`note-edit-${note.id}`}
                            value={form.data.body}
                            maxLength={20000}
                            onChange={(event) =>
                                form.setData('body', event.target.value)
                            }
                            required
                        />
                        <InputError message={form.errors.body} />
                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                size="sm"
                                disabled={form.processing}
                            >
                                Simpan
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="quiet"
                                onClick={() => {
                                    form.reset();
                                    setEditing(false);
                                }}
                            >
                                Batal
                            </Button>
                        </div>
                    </form>
                ) : (
                    <p className="text-body break-words whitespace-pre-wrap text-text">
                        {note.body}
                    </p>
                )}
            </div>
            {note.can_edit && !editing && (
                <div className="flex shrink-0 items-start gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ubah notulensi"
                        onClick={() => setEditing(true)}
                    >
                        <Pencil aria-hidden />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Hapus notulensi"
                        onClick={() => {
                            if (window.confirm('Hapus notulensi ini?')) {
                                router.delete(hiringUrls.note(note.id), {
                                    preserveScroll: true,
                                    onError: () =>
                                        toast.error(
                                            'Gagal menghapus notulensi.',
                                        ),
                                });
                            }
                        }}
                    >
                        <Trash2 aria-hidden />
                    </Button>
                </div>
            )}
        </li>
    );
}

/** Tab Notulensi: interview minutes; every reviewer adds, authors edit their own. */
export function NotesTab({
    candidate,
    notes,
}: Pick<CandidateProfileProps, 'candidate' | 'notes'>) {
    const form = useForm({ body: '' });

    return (
        <div className="flex flex-col gap-5">
            <Panel title="Tambah notulensi">
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(hiringUrls.notes(candidate.id), {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                >
                    <Label htmlFor="note-new" className="sr-only">
                        Notulensi
                    </Label>
                    <Textarea
                        id="note-new"
                        value={form.data.body}
                        maxLength={20000}
                        placeholder="Catat jalannya wawancara, kesan, dan tindak lanjut"
                        onChange={(event) =>
                            form.setData('body', event.target.value)
                        }
                        required
                    />
                    <InputError message={form.errors.body} />
                    <div>
                        <Button
                            type="submit"
                            disabled={
                                form.processing || form.data.body.trim() === ''
                            }
                        >
                            Simpan notulensi
                        </Button>
                    </div>
                </form>
            </Panel>
            <Panel title={`Notulensi (${notes.length})`}>
                {notes.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={NotebookPen}
                        title="Belum ada notulensi"
                    />
                ) : (
                    <ul className="flex flex-col divide-y divide-divider">
                        {notes.map((note) => (
                            <NoteItem key={note.id} note={note} />
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}
