import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { AttachmentsPanel } from '@/features/drive/attachments-panel';
import type { Task } from '../types';
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
    layout: 'sheet' | 'page';
    /** Open another task (sub-task, parent) — the sheet swaps, the page navigates. */
    onOpenTask?: (task: Pick<Task, 'id' | 'number'>) => void;
    /** Page only: chips row above the title (back, key, status, priority). */
    header?: ReactNode;
};

/**
 * Desktop task detail (DTugas / SDetailTugas): chips, 40px title,
 * description, then cards for checklist, sub-tasks, Drive attachments and
 * "Komentar & aktivitas" (timeline + composer); the properties card sits in
 * a right column on the full page, at the top inside the 640px sheet.
 */
export function TaskDetailBody({
    state,
    today,
    layout,
    onOpenTask,
    header,
}: Props) {
    const { detail, viewer } = state;
    const { task, can, parent } = detail;
    const open =
        onOpenTask ??
        ((target: Pick<Task, 'id' | 'number'>) =>
            router.visit(`/w/${detail.workspace.key}/tasks/${target.number}`));

    const main = (
        <div className="flex min-w-0 flex-col gap-5">
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
                        className="text-left font-mono text-[14px] font-semibold text-text-muted hover:text-text hover:underline"
                    >
                        {parent.key} › {parent.title}
                    </button>
                )}
                <TitleField
                    value={task.title}
                    editable={can.edit}
                    onSave={(title) => void state.update({ title })}
                    className={
                        layout === 'page'
                            ? 'text-[34px] leading-[42px] font-extrabold tracking-[-0.025em] xl:text-[40px] xl:leading-[48px]'
                            : 'text-[26px] leading-[34px] font-bold tracking-[-0.02em]'
                    }
                />
                <DescriptionField
                    value={task.description}
                    references={detail.references}
                    workspaceKey={detail.workspace.key}
                    editable={can.edit}
                    onSave={(description) => state.update({ description })}
                    onTyping={() => signalTaskTyping(task.id, 'description')}
                    textClassName={
                        layout === 'page'
                            ? 'text-body-lg text-text-muted'
                            : undefined
                    }
                />
            </div>

            {layout === 'sheet' && (
                <PropertiesPanel state={state} today={today} />
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

            <AttachmentsPanel
                key={task.id}
                attachableType="task"
                attachableId={task.id}
                initial={detail.attachments}
                onChange={state.refresh}
            />

            <div className="flex flex-col gap-5 rounded-panel border border-border bg-surface px-6 pt-5 pb-6 shadow-card">
                <TimelineSection state={state} />

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
                        drive={detail.attachments.drive}
                        onAttachmentsChange={state.refresh}
                        onTyping={() => signalTaskTyping(task.id, 'comment')}
                    />
                ) : (
                    <p className="text-[15px] text-text-muted">
                        Workspace diarsipkan: komentar tidak dapat ditambahkan.
                    </p>
                )}
            </div>
        </div>
    );

    if (layout === 'sheet') {
        return <div className="px-6 py-6">{main}</div>;
    }

    return (
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
            {header && <div className="min-w-0 lg:col-start-1">{header}</div>}
            <aside
                aria-label="Properti tugas"
                className="order-last min-w-0 lg:sticky lg:top-[calc(var(--menu-bar-height)+24px)] lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1"
            >
                <PropertiesPanel state={state} today={today} />
            </aside>
            <div className="min-w-0 lg:col-start-1">{main}</div>
        </div>
    );
}
