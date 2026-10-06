import { LayoutTemplate, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/tabs';
import { AutomationNav } from '@/features/automation/automation-nav';
import { ConfirmDelete } from '@/features/automation/confirm-delete';
import { mutate } from '@/features/automation/mutation';
import { PageHeading } from '@/features/automation/preview-state';
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
import taskTemplateRoutes from '@/routes/automation/templates/tasks';
import workspaceTemplateRoutes from '@/routes/automation/templates/workspaces';

type Tab = 'task' | 'workspace';

type Deleting =
    | { kind: 'task'; template: TaskTemplate }
    | { kind: 'workspace'; template: WorkspaceTemplate };

/**
 * /otomasi/template — task templates (company-wide + the person's
 * workspaces) and the company's workspace templates. "Pakai template"
 * really creates the task / workspace on the server.
 */
export function TemplatesScreen({
    props,
    mobile,
}: {
    props: TemplatesProps;
    mobile: boolean;
}) {
    const [tab, setTab] = useState<Tab>('task');
    const [usingTask, setUsingTask] = useState<TaskTemplate | null>(null);
    const [usingWorkspace, setUsingWorkspace] =
        useState<WorkspaceTemplate | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<Deleting | null>(null);
    const [removing, setRemoving] = useState(false);
    const taskTemplates = props.task_templates;
    const workspaceTemplates = props.workspace_templates;
    const canCreate =
        props.can_create_company_template ||
        props.workspaces.some((w) => w.can_manage);
    const keyOf = (id: string | null) =>
        props.workspaces.find((w) => w.id === id)?.key;
    const canUseTask = (template: TaskTemplate) =>
        props.workspaces.some(
            (w) =>
                w.can_edit_tasks &&
                (template.workspace_id === null ||
                    w.id === template.workspace_id),
        );

    const remove = () => {
        if (!deleting) {
            return;
        }

        setRemoving(true);
        mutate(
            'delete',
            deleting.kind === 'task'
                ? taskTemplateRoutes.destroy.url(deleting.template.id)
                : workspaceTemplateRoutes.destroy.url(deleting.template.id),
            {},
            {
                only: ['templates'],
                onSuccess: () => setDeleting(null),
                onFinish: () => setRemoving(false),
            },
        );
    };

    const newButton = canCreate ? (
        <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Template tugas baru
        </Button>
    ) : undefined;

    const list = tab === 'task' ? taskTemplates : workspaceTemplates;

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <PageHeading
                title="Template"
                description="Mulai tugas dan workspace dari pola yang sudah terbukti."
                actions={
                    !mobile && tab === 'task' && taskTemplates.length > 0
                        ? newButton
                        : undefined
                }
            />
            <AutomationNav />
            <div className="flex flex-col gap-5">
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
                                          workspaceKey={
                                              keyOf(t.workspace_id) ?? undefined
                                          }
                                          onUse={
                                              canUseTask(t)
                                                  ? () => setUsingTask(t)
                                                  : null
                                          }
                                          onDelete={
                                              t.can_manage
                                                  ? () =>
                                                        setDeleting({
                                                            kind: 'task',
                                                            template: t,
                                                        })
                                                  : undefined
                                          }
                                      />
                                  ))
                                : workspaceTemplates.map((t) => (
                                      <WorkspaceTemplateCard
                                          key={t.id}
                                          template={t}
                                          onUse={
                                              t.can_use
                                                  ? () => setUsingWorkspace(t)
                                                  : null
                                          }
                                          onDelete={
                                              t.can_delete
                                                  ? () =>
                                                        setDeleting({
                                                            kind: 'workspace',
                                                            template: t,
                                                        })
                                                  : undefined
                                          }
                                      />
                                  ))}
                        </div>
                    )}
                </div>
                {mobile &&
                    tab === 'task' &&
                    taskTemplates.length > 0 &&
                    canCreate && (
                        <Fab
                            label="Template tugas baru"
                            onClick={() => setCreating(true)}
                        />
                    )}
            </div>
            {usingTask && (
                <UseTaskTemplate
                    template={usingTask}
                    workspaces={props.workspaces}
                    mobile={mobile}
                    onOpenChange={(open) => !open && setUsingTask(null)}
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
                    workspaces={props.workspaces}
                    canCreateCompanyTemplate={props.can_create_company_template}
                    onOpenChange={setCreating}
                />
            )}
            <ConfirmDelete
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title={`Hapus template "${deleting?.template.name ?? ''}"?`}
                description={
                    deleting?.kind === 'workspace'
                        ? 'Workspace yang sudah dibuat dari template ini tetap ada.'
                        : 'Tugas yang sudah dibuat dari template ini tetap ada.'
                }
                processing={removing}
                mobile={mobile}
                onConfirm={remove}
            />
        </div>
    );
}
