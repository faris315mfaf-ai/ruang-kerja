import { router } from '@inertiajs/react';
import {
    ChevronRight,
    Eye,
    EyeOff,
    MoreHorizontal,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AttachmentsPanel } from '@/features/drive/attachments-panel';
import { useKeyboardInset, useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { cn, focusRing } from '@/lib/utils';
import { DueBadge } from '../due-badge';
import {
    AssigneePicker,
    DuePicker,
    LabelPicker,
    PriorityPicker,
} from '../form/pickers';
import { StatusPill } from '../status-pill';
import { ChecklistSection } from './checklist';
import { CommentComposer } from './comment-composer';
import { signalTaskTyping } from '../realtime/workspace-presence';
import { DescriptionField } from './description-field';
import { PropertiesPanel } from './properties';
import { SubtasksSection } from './subtasks';
import { TimelineSection } from './timeline-section';
import { TitleField } from './title-field';
import type { TaskDetailState } from './use-task-detail';
import type { TaskDetail } from './types';

type Props = {
    state: TaskDetailState & { detail: TaskDetail };
    today: string;
};

/**
 * Status track of the phone detail (MSDetailTugas "Todo · Dikerjakan ·
 * Review · Selesai"): one tap moves the task; the current status is the
 * gradient pill. Scrolls sideways when a workspace has many statuses.
 */
function StatusTrack({
    state,
}: {
    state: TaskDetailState & { detail: TaskDetail };
}) {
    const { detail } = state;
    const statuses = detail.statuses.filter(
        (status) =>
            status.category !== 'canceled' ||
            status.id === detail.task.status_id,
    );
    const activeRef = useRef<HTMLButtonElement>(null);
    const activeId = detail.task.status_id;

    // Long tracks scroll sideways: keep the current status in view.
    useEffect(() => {
        activeRef.current?.scrollIntoView?.({
            block: 'nearest',
            inline: 'center',
        });
    }, [activeId]);

    return (
        <div
            role="radiogroup"
            aria-label="Status"
            className="-mx-4 flex [scrollbar-width:none] overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
        >
            <div className="flex min-w-full gap-1 rounded-lg bg-surface-2 p-1">
                {statuses.map((status) => {
                    const active = status.id === detail.task.status_id;

                    return (
                        <button
                            key={status.id}
                            ref={active ? activeRef : undefined}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                                if (!active) {
                                    void state.update(
                                        { status_id: status.id },
                                        {
                                            task: {
                                                ...detail.task,
                                                status_id: status.id,
                                                status_category:
                                                    status.category,
                                            },
                                        },
                                    );
                                }
                            }}
                            className={cn(
                                'h-11 flex-1 shrink-0 rounded-control px-3 text-[15px] font-bold whitespace-nowrap transition-colors duration-120 ease-brand',
                                focusRing,
                                active
                                    ? 'bg-primary bg-grad-aksi text-on-brand shadow-button'
                                    : 'text-text-muted',
                            )}
                        >
                            {status.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Mobile task detail (MSDetailTugas): key + due chips, 26px title, status
 * track, property chips + "Semua properti" sheet, then cards for checklist,
 * sub-tasks, Drive attachments (Lampirkan · Kamera · Drive · File) and the
 * timeline; the comment box sticks to the bottom (above the tab bar, or the
 * keyboard while typing).
 */
export function TaskDetailMobile({ state, today }: Props) {
    const { detail, viewer } = state;
    const { task, can } = detail;
    const [allProperties, setAllProperties] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const keyboardOpen = useKeyboardOpen();
    const keyboardInset = useKeyboardInset();

    return (
        <div className="flex flex-col gap-4 pb-24">
            {(!can.edit || task.due_date) && (
                <div className="flex min-h-9 items-center gap-2">
                    {!can.edit && (
                        <StatusPill
                            name={
                                detail.statuses.find(
                                    (status) => status.id === task.status_id,
                                )?.name ?? ''
                            }
                            category={task.status_category}
                        />
                    )}
                    {task.due_date && (
                        <span className="ml-auto inline-flex h-9 items-center rounded-full bg-surface-2 px-3">
                            <DueBadge
                                due={task.due_date}
                                today={today}
                                closed={
                                    task.status_category === 'done' ||
                                    task.status_category === 'canceled'
                                }
                            />
                        </span>
                    )}
                </div>
            )}
            <div className="flex items-start gap-2">
                <TitleField
                    value={task.title}
                    editable={can.edit}
                    onSave={(title) => void state.update({ title })}
                    className="text-h1 font-extrabold tracking-[-0.02em]"
                    tapToEdit
                />
                {(can.watch || can.delete) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Menu tugas"
                                className={appBarIconButton}
                            >
                                <MoreHorizontal
                                    className="size-5"
                                    aria-hidden
                                />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            {detail.can.watch && (
                                <DropdownMenuItem
                                    onSelect={() => void state.toggleWatch()}
                                >
                                    {detail.watching ? (
                                        <EyeOff aria-hidden />
                                    ) : (
                                        <Eye aria-hidden />
                                    )}
                                    {detail.watching
                                        ? 'Berhenti amati'
                                        : 'Amati tugas'}
                                </DropdownMenuItem>
                            )}
                            {can.delete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => setConfirming(true)}
                                    >
                                        <Trash2 aria-hidden />
                                        Hapus tugas
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {confirming && (
                <div
                    role="alertdialog"
                    aria-label="Hapus tugas"
                    className="space-y-3 rounded-card border border-danger/40 bg-danger-soft p-4 text-[16px]"
                >
                    <p className="text-text">Hapus {task.key}?</p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1"
                            onClick={() => setConfirming(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="h-11 flex-1"
                            onClick={async () => {
                                setConfirming(false);

                                if (await state.deleteTask()) {
                                    router.visit(`/w/${detail.workspace.key}`);
                                }
                            }}
                        >
                            Hapus
                        </Button>
                    </div>
                </div>
            )}

            {can.edit && <StatusTrack state={state} />}

            {can.edit ? (
                <div className="flex flex-wrap gap-2">
                    <PriorityPicker
                        size="touch"
                        value={task.priority}
                        onChange={(priority) => void state.update({ priority })}
                    />
                    <AssigneePicker
                        size="touch"
                        people={detail.members}
                        value={task.assignee_ids}
                        currentUserId={viewer?.id}
                        onChange={(ids) =>
                            void state.update({ assignee_ids: ids })
                        }
                    />
                    <DuePicker
                        size="touch"
                        value={task.due_date}
                        today={today}
                        onChange={(due) => void state.update({ due_date: due })}
                    />
                    <LabelPicker
                        size="touch"
                        labels={detail.labels}
                        value={task.label_ids}
                        onChange={(ids) =>
                            void state.update({ label_ids: ids })
                        }
                    />
                    <button
                        type="button"
                        onClick={() => setAllProperties(true)}
                        className={cn(
                            'inline-flex h-11 items-center gap-1 rounded-control px-2 text-[16px] font-semibold text-link',
                            focusRing,
                        )}
                    >
                        Semua properti
                        <ChevronRight className="size-4" aria-hidden />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAllProperties(true)}
                    className={cn(
                        'inline-flex h-11 items-center gap-1 self-start rounded-control text-[16px] font-semibold text-link',
                        focusRing,
                    )}
                >
                    Lihat properti
                    <ChevronRight className="size-4" aria-hidden />
                </button>
            )}

            <section
                aria-labelledby="mobile-description"
                className="space-y-1.5"
            >
                <h2
                    id="mobile-description"
                    className="text-overline text-text-muted"
                >
                    Deskripsi
                </h2>
                <DescriptionField
                    value={task.description}
                    references={detail.references}
                    workspaceKey={detail.workspace.key}
                    editable={can.edit}
                    onSave={(description) => state.update({ description })}
                    onTyping={() => signalTaskTyping(task.id, 'description')}
                />
            </section>

            <ChecklistSection
                mobile
                items={detail.checklist}
                members={detail.members}
                editable={can.edit}
                onAdd={(title) => void state.addChecklistItem(title)}
                onToggle={(item, done) =>
                    void state.updateChecklistItem(item.id, { is_done: done })
                }
                onRename={(item, title) =>
                    void state.updateChecklistItem(item.id, { title })
                }
                onDelete={(item) => void state.deleteChecklistItem(item.id)}
            />

            <SubtasksSection
                mobile
                subtasks={detail.subtasks}
                statuses={detail.statuses}
                members={detail.members}
                editable={can.edit}
                onOpen={(sub) =>
                    router.visit(
                        `/w/${detail.workspace.key}/tasks/${sub.number}`,
                    )
                }
                onCreate={(title) => void state.createSubtask(title)}
            />

            <AttachmentsPanel
                key={task.id}
                attachableType="task"
                attachableId={task.id}
                initial={detail.attachments}
                variant="mobile"
                onChange={state.refresh}
            />

            <div className="rounded-panel border border-border bg-surface px-4 pt-3 pb-4 shadow-card">
                <TimelineSection state={state} mobile />
            </div>

            {can.comment && (
                <div
                    className="glass fixed inset-x-0 z-30 border-x-0 border-b-0 px-3 py-2"
                    style={{
                        bottom: keyboardOpen
                            ? `${keyboardInset}px`
                            : 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom))',
                    }}
                >
                    <CommentComposer
                        variant="mobile"
                        workspaceKey={detail.workspace.key}
                        author={
                            viewer
                                ? {
                                      name: viewer.name,
                                      avatar: viewer.avatar ?? null,
                                  }
                                : null
                        }
                        onSubmit={state.postComment}
                        drive={detail.attachments.drive}
                        onAttachmentsChange={state.refresh}
                        onTyping={() => signalTaskTyping(task.id, 'comment')}
                        placeholder="Tulis komentar…"
                    />
                </div>
            )}

            <BottomSheet
                open={allProperties}
                onOpenChange={setAllProperties}
                title="Properti tugas"
            >
                <PropertiesPanel state={state} today={today} />
            </BottomSheet>
        </div>
    );
}
