import { router } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import type { Task } from '../types';
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
    layout: 'sheet' | 'page';
    /** Open another task (sub-task, parent) — the sheet swaps, the page navigates. */
    onOpenTask?: (task: Pick<Task, 'id' | 'number'>) => void;
};

/**
 * Desktop task detail (mockup TaskDetail): title, description, checklist,
 * sub-tasks, timeline + composer; properties in a right column on the
 * full page, at the top inside the 640px sheet.
 */
export function TaskDetailBody({ state, today, layout, onOpenTask }: Props) {
    const { detail, viewer } = state;
    const { task, can, parent } = detail;
    const open =
        onOpenTask ??
        ((target: Pick<Task, 'id' | 'number'>) =>
            router.visit(`/w/${detail.workspace.key}/tasks/${target.number}`));

    const main = (
        <div className="min-w-0 space-y-6">
            <div className="space-y-3">
                {parent && (
                    <button
                        type="button"
                        onClick={() =>
                            open({
                                id: parent.id,
                                number: Number(parent.key.split('-').pop()),
                            })
                        }
                        className="font-mono text-xs text-text-muted hover:text-text hover:underline"
                    >
                        {parent.key} › {parent.title}
                    </button>
                )}
                <TitleField
                    value={task.title}
                    editable={can.edit}
                    onSave={(title) => void state.update({ title })}
                    className="text-[22px] leading-tight"
                />
                <DescriptionField
                    value={task.description}
                    references={detail.references}
                    workspaceKey={detail.workspace.key}
                    editable={can.edit}
                    onSave={(description) => state.update({ description })}
                />
            </div>

            {layout === 'sheet' && (
                <div className="rounded-lg border border-border bg-surface p-4">
                    <PropertiesPanel state={state} today={today} />
                </div>
            )}

            <ChecklistSection
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
                subtasks={detail.subtasks}
                statuses={detail.statuses}
                members={detail.members}
                editable={can.edit}
                onOpen={open}
                onCreate={(title) => void state.createSubtask(title)}
            />

            <div className="border-t border-border pt-6">
                <TimelineSection state={state} />
            </div>

            {can.comment ? (
                <CommentComposer
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
                />
            ) : (
                <p className="text-[13px] text-text-muted">
                    Workspace diarsipkan: komentar tidak dapat ditambahkan.
                </p>
            )}
        </div>
    );

    if (layout === 'sheet') {
        return <div className="px-6 py-6">{main}</div>;
    }

    return (
        <div
            className={cn(
                'grid min-h-full grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]',
            )}
        >
            <div className="mx-auto w-full max-w-[820px] px-6 py-8 xl:px-8">
                {main}
            </div>
            <aside
                aria-label="Properti tugas"
                className="border-l border-border px-5 py-6"
            >
                <div className="sticky top-20">
                    <PropertiesPanel state={state} today={today} />
                </div>
            </aside>
        </div>
    );
}
