import { router } from '@inertiajs/react';
import {
    ChevronRight,
    Eye,
    EyeOff,
    MoreHorizontal,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useKeyboardInset, useKeyboardOpen } from '@/hooks/use-keyboard-open';
import {
    AssigneePicker,
    DuePicker,
    LabelPicker,
    PriorityPicker,
    StatusPicker,
} from '../form/pickers';
import { ChecklistSection } from './checklist';
import { CommentComposer } from './comment-composer';
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
 * Mobile task detail (mockup MTaskDetail): full screen, property chips,
 * "Semua properti" sheet, checklist/sub-tasks with 44px targets, timeline,
 * and a comment box stuck to the bottom (above the tab bar, or the
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
        <div className="space-y-6 pb-24">
            <div className="flex items-start gap-2">
                <TitleField
                    value={task.title}
                    editable={can.edit}
                    onSave={(title) => void state.update({ title })}
                    className="text-2xl leading-tight"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="Menu tugas"
                            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-2"
                        >
                            <MoreHorizontal className="size-5" aria-hidden />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                            onSelect={() => void state.toggleWatch()}
                        >
                            {detail.watching ? (
                                <EyeOff aria-hidden />
                            ) : (
                                <Eye aria-hidden />
                            )}
                            {detail.watching ? 'Berhenti amati' : 'Amati tugas'}
                        </DropdownMenuItem>
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
            </div>

            {confirming && (
                <div
                    role="alertdialog"
                    aria-label="Hapus tugas"
                    className="space-y-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-[15px]"
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

            {can.edit ? (
                <div className="flex flex-wrap gap-2">
                    <StatusPicker
                        size="touch"
                        statuses={detail.statuses}
                        value={task.status_id}
                        onChange={(id) => void state.update({ status_id: id })}
                    />
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
                        className="inline-flex h-11 items-center gap-1 px-2 text-[15px] font-medium text-primary"
                    >
                        Semua properti
                        <ChevronRight className="size-4" aria-hidden />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAllProperties(true)}
                    className="inline-flex h-11 items-center gap-1 text-[15px] font-medium text-primary"
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
                    className="text-[15px] text-text-muted"
                >
                    Deskripsi
                </h2>
                <DescriptionField
                    value={task.description}
                    references={detail.references}
                    workspaceKey={detail.workspace.key}
                    editable={can.edit}
                    onSave={(description) => state.update({ description })}
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

            <TimelineSection state={state} mobile />

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
