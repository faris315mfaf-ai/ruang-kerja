import type { DragEndEvent } from '@dnd-kit/core';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { router } from '@inertiajs/react';
import { GripVertical, Info, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { StatusIcon } from '@/components/status-icon';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { StatusCategory } from '@/features/tasks/types';
import { cn } from '@/lib/utils';
import { destroy, reorder, store, update } from '@/routes/workspaces/statuses';
import type { Option, StatusWithCount, WorkspaceDetail } from '../types';
import { ColorSelect } from './color-select';
import { SettingsCard, selectClass } from './settings-card';

type Props = {
    workspace: WorkspaceDetail;
    statuses: StatusWithCount[];
    categoryOptions: Option<StatusCategory>[];
    editable: boolean;
};

function Row({
    workspace,
    status,
    categoryOptions,
    editable,
    onDelete,
}: {
    workspace: WorkspaceDetail;
    status: StatusWithCount;
    categoryOptions: Option<StatusCategory>[];
    editable: boolean;
    onDelete: (status: StatusWithCount) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: status.id, disabled: !editable });
    const [name, setName] = useState(status.name);
    const save = (changes: Record<string, string>) =>
        router.patch(
            update.url({ workspace: workspace.key, status: status.id }),
            changes,
            { preserveScroll: true },
        );

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: transform
                    ? `translate3d(0, ${transform.y}px, 0)`
                    : undefined,
                transition,
            }}
            className={cn(
                'grid grid-cols-[24px_20px_minmax(0,1fr)_170px_40px_32px] items-center gap-2 bg-surface px-3 py-2',
                isDragging && 'relative z-10 shadow-card',
            )}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Ubah urutan ${status.name}`}
                disabled={!editable}
                className="flex h-8 cursor-grab items-center justify-center rounded text-text-subtle hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-40"
            >
                <GripVertical className="size-4" />
            </button>
            <StatusIcon category={status.category} color={status.color} />
            <input
                aria-label="Nama kolom"
                value={name}
                disabled={!editable}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                onBlur={() =>
                    name.trim() !== '' &&
                    name !== status.name &&
                    save({ name: name.trim() })
                }
                onKeyDown={(event) =>
                    event.key === 'Enter' && event.currentTarget.blur()
                }
                className="h-8 rounded-md border border-transparent bg-transparent px-2 text-[13px] text-text hover:border-border focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            <select
                aria-label={`Kategori ${status.name}`}
                value={status.category}
                disabled={!editable}
                onChange={(event) => save({ category: event.target.value })}
                className={selectClass}
            >
                {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <ColorSelect
                label={`Warna ${status.name}`}
                value={status.color}
                disabled={!editable}
                onChange={(color) => save({ color })}
            />
            {editable ? (
                <button
                    type="button"
                    aria-label={`Hapus kolom ${status.name}`}
                    onClick={() => onDelete(status)}
                    className="flex size-8 items-center justify-center rounded text-text-subtle hover:bg-surface-2 hover:text-danger focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <Trash2 className="size-4" />
                </button>
            ) : (
                <span />
            )}
        </li>
    );
}

/** Pengaturan › Kolom status: rename, category, color, drag to reorder, add, delete (moving tasks). */
export function StatusesSection({
    workspace,
    statuses,
    categoryOptions,
    editable,
}: Props) {
    const [order, setOrder] = useState(statuses.map((status) => status.id));
    const [source, setSource] = useState(statuses);
    const [deleting, setDeleting] = useState<StatusWithCount | null>(null);
    const [target, setTarget] = useState('');
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    if (source !== statuses) {
        setSource(statuses);
        setOrder(statuses.map((status) => status.id));
    }

    const byId = Object.fromEntries(
        statuses.map((status) => [status.id, status]),
    );
    const ordered = order.flatMap((id) => (byId[id] ? [byId[id]] : []));

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }

        const next = arrayMove(
            order,
            order.indexOf(String(active.id)),
            order.indexOf(String(over.id)),
        );
        setOrder(next);
        router.put(
            reorder.url(workspace.key),
            { status_ids: next },
            {
                preserveScroll: true,
                onError: () => setOrder(statuses.map((status) => status.id)),
            },
        );
    };

    const askDelete = (status: StatusWithCount) => {
        if (status.tasks_count === 0) {
            router.delete(
                destroy.url({ workspace: workspace.key, status: status.id }),
                { preserveScroll: true },
            );

            return;
        }

        setTarget(
            ordered.find((candidate) => candidate.id !== status.id)?.id ?? '',
        );
        setDeleting(status);
    };

    return (
        <SettingsCard
            id="kolom-status"
            title="Kolom status"
            description="Urutan kolom di board. Seret untuk mengubah urutan."
            action={
                editable && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            router.post(
                                store.url(workspace.key),
                                { name: 'Kolom baru', category: 'todo' },
                                { preserveScroll: true },
                            )
                        }
                    >
                        <Plus />
                        Tambah kolom
                    </Button>
                )
            }
        >
            <p className="flex items-center gap-2 border-b border-border bg-info/10 px-4 py-2.5 text-[13px] text-text">
                <Info className="size-4 shrink-0 text-info" aria-hidden />
                Metrik dashboard memakai kategori, bukan nama kolom. Mis. kolom
                “Menunggu persetujuan” berkategori Review dihitung sebagai
                Review.
            </p>
            <div className="grid grid-cols-[24px_20px_minmax(0,1fr)_170px_40px_32px] gap-2 bg-surface-2 px-3 py-2 text-[12px] text-text-muted">
                <span />
                <span />
                <span>Nama kolom</span>
                <span>Kategori</span>
                <span>Warna</span>
                <span />
            </div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
            >
                <SortableContext
                    items={order}
                    strategy={verticalListSortingStrategy}
                >
                    <ul className="divide-y divide-border">
                        {ordered.map((status) => (
                            <Row
                                key={status.id}
                                workspace={workspace}
                                status={status}
                                categoryOptions={categoryOptions}
                                editable={editable}
                                onDelete={askDelete}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent className="bg-surface">
                    <DialogHeader>
                        <DialogTitle>Hapus kolom {deleting?.name}?</DialogTitle>
                        <DialogDescription>
                            {deleting?.tasks_count} tugas di kolom ini akan
                            dipindahkan ke kolom lain. Riwayatnya tetap
                            tersimpan.
                        </DialogDescription>
                    </DialogHeader>
                    <label className="space-y-1.5 text-[13px]">
                        <span className="font-medium text-text">
                            Pindahkan tugas ke
                        </span>
                        <select
                            value={target}
                            onChange={(event) => setTarget(event.target.value)}
                            className={cn(selectClass, 'h-9 w-full')}
                        >
                            {ordered
                                .filter((status) => status.id !== deleting?.id)
                                .map((status) => (
                                    <option key={status.id} value={status.id}>
                                        {status.name}
                                    </option>
                                ))}
                        </select>
                    </label>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleting(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={target === ''}
                            onClick={() =>
                                deleting &&
                                router.delete(
                                    destroy.url({
                                        workspace: workspace.key,
                                        status: deleting.id,
                                    }),
                                    {
                                        data: { target_status_id: target },
                                        preserveScroll: true,
                                        onSuccess: () => setDeleting(null),
                                    },
                                )
                            }
                        >
                            Hapus kolom
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SettingsCard>
    );
}
