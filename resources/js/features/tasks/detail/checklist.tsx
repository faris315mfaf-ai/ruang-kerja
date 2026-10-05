import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { WorkspaceMember } from '../types';
import type { ChecklistEntry } from './types';

type Props = {
    items: ChecklistEntry[];
    members: WorkspaceMember[];
    editable: boolean;
    mobile?: boolean;
    onAdd: (title: string) => void;
    onToggle: (item: ChecklistEntry, done: boolean) => void;
    onRename: (item: ChecklistEntry, title: string) => void;
    onDelete: (item: ChecklistEntry) => void;
};

function ItemRow({
    item,
    doneBy,
    editable,
    mobile,
    onToggle,
    onRename,
    onDelete,
}: {
    item: ChecklistEntry;
    doneBy: WorkspaceMember | undefined;
    editable: boolean;
    mobile: boolean;
    onToggle: (done: boolean) => void;
    onRename: (title: string) => void;
    onDelete: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.title);

    const commit = () => {
        setEditing(false);
        const title = draft.trim();

        if (title !== '' && title !== item.title) {
            onRename(title);
        } else {
            setDraft(item.title);
        }
    };

    return (
        <li
            className={cn(
                'group flex items-center gap-3 px-3',
                mobile ? 'min-h-12' : 'min-h-9',
            )}
        >
            <Checkbox
                checked={item.is_done}
                disabled={!editable}
                onCheckedChange={(checked) => onToggle(checked === true)}
                aria-label={item.title}
                className={cn(mobile && 'size-6')}
            />
            {editing ? (
                <input
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by an explicit edit action
                    autoFocus
                    aria-label="Ubah item checklist"
                    value={draft}
                    maxLength={255}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.currentTarget.blur();
                        }

                        if (event.key === 'Escape') {
                            event.stopPropagation();
                            setDraft(item.title);
                            setEditing(false);
                        }
                    }}
                    className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2 text-text outline-none"
                />
            ) : (
                <button
                    type="button"
                    disabled={!editable}
                    onClick={() => setEditing(true)}
                    className={cn(
                        'min-w-0 flex-1 py-1 text-left disabled:cursor-default',
                        mobile ? 'text-[15px]' : 'text-[13px]',
                        item.is_done
                            ? 'text-text-muted line-through'
                            : 'text-text',
                    )}
                >
                    {item.title}
                </button>
            )}
            {doneBy && item.is_done && (
                <UserAvatar
                    name={doneBy.name}
                    src={doneBy.avatar}
                    className="size-5 text-[9px]"
                />
            )}
            {editable && (
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label={`Hapus ${item.title}`}
                    className={cn(
                        'flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-danger focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        !mobile && 'opacity-0 group-hover:opacity-100',
                    )}
                >
                    <Trash2 className="size-3.5" aria-hidden />
                </button>
            )}
        </li>
    );
}

/** Checklist with progress, "Sembunyikan yang selesai", inline add/rename. */
export function ChecklistSection({
    items,
    members,
    editable,
    mobile = false,
    onAdd,
    onToggle,
    onRename,
    onDelete,
}: Props) {
    const [hideDone, setHideDone] = useState(mobile);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState('');
    const done = items.filter((item) => item.is_done).length;
    const visible = hideDone ? items.filter((item) => !item.is_done) : items;
    const percent = items.length === 0 ? 0 : (done / items.length) * 100;

    if (items.length === 0 && !editable) {
        return null;
    }

    const submit = () => {
        const title = draft.trim();

        if (title !== '') {
            onAdd(title);
            setDraft('');
        }
    };

    return (
        <section
            aria-labelledby="task-checklist"
            className={cn(
                !mobile && 'rounded-lg border border-border bg-surface',
            )}
        >
            <header
                className={cn(
                    'flex items-center gap-3',
                    mobile
                        ? 'mb-1 min-h-11'
                        : 'h-11 border-b border-border px-3',
                )}
            >
                <h2
                    id="task-checklist"
                    className={cn(
                        'font-medium text-text',
                        mobile ? 'text-[15px]' : 'text-[13px]',
                    )}
                >
                    Checklist
                </h2>
                {items.length > 0 && (
                    <>
                        <span className="text-[13px] text-text-muted tnum">
                            {done}/{items.length}
                        </span>
                        <span
                            className="h-1 w-40 max-w-[40%] overflow-hidden rounded-full bg-surface-2"
                            role="progressbar"
                            aria-valuenow={Math.round(percent)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Progres checklist"
                        >
                            <span
                                className="block h-full rounded-full bg-primary transition-[width] duration-200 ease-brand"
                                style={{ width: `${percent}%` }}
                            />
                        </span>
                    </>
                )}
                <span className="ml-auto flex items-center gap-1">
                    {!mobile && done > 0 && (
                        <button
                            type="button"
                            onClick={() => setHideDone(!hideDone)}
                            className="text-[13px] text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            {hideDone
                                ? 'Tampilkan yang selesai'
                                : 'Sembunyikan yang selesai'}
                        </button>
                    )}
                    {editable && (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            aria-label="Tambah item checklist"
                            className={cn(
                                'flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                mobile ? 'size-11' : 'size-7',
                            )}
                        >
                            <Plus className="size-4" aria-hidden />
                        </button>
                    )}
                </span>
            </header>

            {mobile && done > 0 && (
                <button
                    type="button"
                    onClick={() => setHideDone(!hideDone)}
                    className="flex min-h-11 w-full items-center gap-3 px-3 text-[15px] text-text-muted"
                >
                    <ChevronDown
                        className={cn(
                            'size-4 transition-transform',
                            !hideDone && 'rotate-180',
                        )}
                        aria-hidden
                    />
                    {hideDone
                        ? `${done} item selesai lainnya`
                        : 'Sembunyikan yang selesai'}
                    <span className="ml-auto text-primary">
                        {hideDone ? 'Tampilkan' : ''}
                    </span>
                </button>
            )}

            <ul className={cn(!mobile && 'py-1')}>
                {visible.map((item) => (
                    <ItemRow
                        key={item.id}
                        item={item}
                        doneBy={members.find((m) => m.id === item.done_by)}
                        editable={editable}
                        mobile={mobile}
                        onToggle={(value) => onToggle(item, value)}
                        onRename={(title) => onRename(item, title)}
                        onDelete={() => onDelete(item)}
                    />
                ))}
            </ul>

            {editable && (adding || items.length === 0) && (
                <form
                    className={cn(
                        'flex items-center gap-2 px-3 pb-2',
                        mobile && 'pt-1',
                    )}
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <input
                        aria-label="Item checklist baru"
                        placeholder="Tambah item, lalu Enter"
                        value={draft}
                        maxLength={255}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.stopPropagation();
                                setAdding(false);
                                setDraft('');
                            }
                        }}
                        className={cn(
                            'min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-text placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            mobile ? 'h-11' : 'h-8 text-[13px]',
                        )}
                    />
                </form>
            )}
        </section>
    );
}
