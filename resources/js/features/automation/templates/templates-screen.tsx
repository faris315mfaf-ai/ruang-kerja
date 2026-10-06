import { LayoutTemplate, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/tabs';
import { AutomationNav } from '@/features/automation/automation-nav';
import {
    PageHeading,
    PreviewBar,
    PreviewError,
    PreviewSkeleton,
} from '@/features/automation/preview-state';
import type { PreviewState } from '@/features/automation/preview-state';
import {
    NewTaskTemplate,
    UseTaskTemplate,
    UseWorkspaceTemplate,
} from '@/features/automation/templates/template-dialogs';
import {
    TaskTemplateCard,
    WorkspaceTemplateCard,
} from '@/features/automation/templates/template-parts';
import type {
    TaskTemplate,
    TemplatesProps,
    WorkspaceTemplate,
} from '@/features/automation/types';

type Tab = 'task' | 'workspace';

export function TemplatesScreen({
    props,
    state,
    mobile,
}: {
    props: TemplatesProps;
    state: PreviewState;
    mobile: boolean;
}) {
    const [tab, setTab] = useState<Tab>('task');
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>(
        state === 'empty' ? [] : props.task_templates,
    );
    const workspaceTemplates =
        state === 'empty' ? [] : props.workspace_templates;
    const [usingTask, setUsingTask] = useState<TaskTemplate | null>(null);
    const [usingWorkspace, setUsingWorkspace] =
        useState<WorkspaceTemplate | null>(null);
    const [creating, setCreating] = useState(false);

    const newButton = (
        <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Template tugas baru
        </Button>
    );

    let body;

    if (state === 'loading') {
        body = <PreviewSkeleton />;
    } else if (state === 'error') {
        body = <PreviewError what="Template" />;
    } else {
        const tabs = (
            <SegmentedTabs
                label="Jenis template"
                value={tab}
                onValueChange={setTab}
                options={[
                    {
                        value: 'task',
                        label: `Tugas · ${taskTemplates.length}`,
                        id: 'tpl-tab-task',
                        controls: 'tpl-panel',
                    },
                    {
                        value: 'workspace',
                        label: `Workspace · ${workspaceTemplates.length}`,
                        id: 'tpl-tab-workspace',
                        controls: 'tpl-panel',
                    },
                ]}
                className="self-start"
            />
        );
        const list = tab === 'task' ? taskTemplates : workspaceTemplates;

        body = (
            <div className="flex flex-col gap-5">
                {tabs}
                <div
                    id="tpl-panel"
                    role="tabpanel"
                    aria-labelledby={
                        tab === 'task' ? 'tpl-tab-task' : 'tpl-tab-workspace'
                    }
                >
                    {list.length === 0 ? (
                        <EmptyState
                            icon={LayoutTemplate}
                            title={
                                tab === 'task'
                                    ? 'Belum ada template tugas'
                                    : 'Belum ada template workspace'
                            }
                            description={
                                tab === 'task'
                                    ? 'Simpan langkah yang sering diulang (checklist, label, estimasi) supaya tugas baru tinggal dipakai.'
                                    : 'Template workspace disimpan dari Pengaturan workspace › "Simpan sebagai template".'
                            }
                            action={tab === 'task' ? newButton : undefined}
                        />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-5">
                            {tab === 'task'
                                ? taskTemplates.map((t) => (
                                      <TaskTemplateCard
                                          key={t.id}
                                          template={t}
                                          onUse={() => setUsingTask(t)}
                                      />
                                  ))
                                : workspaceTemplates.map((t) => (
                                      <WorkspaceTemplateCard
                                          key={t.id}
                                          template={t}
                                          onUse={() => setUsingWorkspace(t)}
                                      />
                                  ))}
                        </div>
                    )}
                </div>
                {mobile && tab === 'task' && taskTemplates.length > 0 && (
                    <Fab
                        label="Template tugas baru"
                        onClick={() => setCreating(true)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <PreviewBar />
            <PageHeading
                title="Template"
                description="Mulai tugas dan workspace dari pola yang sudah terbukti."
                actions={
                    !mobile &&
                    state === 'ready' &&
                    tab === 'task' &&
                    taskTemplates.length > 0
                        ? newButton
                        : undefined
                }
            />
            <AutomationNav />
            {body}
            {usingTask && (
                <UseTaskTemplate
                    template={usingTask}
                    workspaces={props.workspaces}
                    mobile={mobile}
                    onOpenChange={(open) => !open && setUsingTask(null)}
                    onUsed={() =>
                        setTaskTemplates((list) =>
                            list.map((t) =>
                                t.id === usingTask.id
                                    ? { ...t, used_count: t.used_count + 1 }
                                    : t,
                            ),
                        )
                    }
                />
            )}
            {usingWorkspace && (
                <UseWorkspaceTemplate
                    template={usingWorkspace}
                    takenKeys={props.workspaces.map((w) => w.key)}
                    mobile={mobile}
                    onOpenChange={(open) => !open && setUsingWorkspace(null)}
                />
            )}
            {creating && (
                <NewTaskTemplate
                    mobile={mobile}
                    onOpenChange={setCreating}
                    onCreated={(template) => {
                        setTaskTemplates((list) => [template, ...list]);
                        setTab('task');
                    }}
                />
            )}
        </div>
    );
}
