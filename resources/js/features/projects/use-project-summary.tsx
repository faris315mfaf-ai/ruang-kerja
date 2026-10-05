import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    DirectionDialog,
    RequestUpdateDialog,
} from '@/features/portfolio/steering-dialogs';
import type {
    MilestoneDetail,
    ProjectSummaryProps,
    ProjectUpdateItem,
    RiskItem,
} from '@/features/portfolio/types';
import type { WorkspaceMember } from '@/features/tasks/types';
import { resolveDecision } from '@/routes/projects/updates';
import { MilestoneDialog, ProjectUpdateDialog, RiskDialog } from './forms';

/**
 * Dialog state of the project summary (desktop & mobile share it). Opening
 * /w/KEY/ringkasan?update=1 (reminder notification) opens the update form.
 */
export function useProjectSummary(
    props: ProjectSummaryProps,
    members: WorkspaceMember[],
) {
    const { url } = usePage();
    const project = { key: props.project.key, name: props.project.name };
    const [updateOpen, setUpdateOpen] = useState(false);
    const [milestone, setMilestone] = useState<MilestoneDetail | 'new' | null>(
        null,
    );
    const [risk, setRisk] = useState<RiskItem | 'new' | null>(null);
    const [direction, setDirection] = useState<{
        updateId: string | null;
        context: string | null;
    } | null>(null);
    const [requestOpen, setRequestOpen] = useState(false);
    const [resolving, setResolving] = useState<string | null>(null);

    useEffect(() => {
        if (props.project_can.manage && url.includes('update=1')) {
            setUpdateOpen(true);
        }
    }, [props.project_can.manage, url]);

    const resolve = (update: ProjectUpdateItem) => {
        setResolving(update.id);
        router.post(
            resolveDecision({
                workspace: project.key,
                projectUpdate: update.id,
            }).url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setResolving(null),
            },
        );
    };

    const dialogs = (
        <>
            {props.project_can.manage && (
                <>
                    <ProjectUpdateDialog
                        projectKey={project.key}
                        healthOptions={props.health_options}
                        open={updateOpen}
                        onOpenChange={setUpdateOpen}
                    />
                    <MilestoneDialog
                        key={
                            milestone === null
                                ? 'closed'
                                : milestone === 'new'
                                  ? 'new'
                                  : milestone.id
                        }
                        projectKey={project.key}
                        milestone={milestone === 'new' ? null : milestone}
                        taskOptions={props.task_options}
                        open={milestone !== null}
                        onOpenChange={(open) => !open && setMilestone(null)}
                    />
                    <RiskDialog
                        key={
                            risk === null
                                ? 'closed'
                                : risk === 'new'
                                  ? 'new'
                                  : risk.id
                        }
                        projectKey={project.key}
                        risk={risk === 'new' ? null : risk}
                        members={members}
                        taskOptions={props.task_options}
                        levelOptions={props.risk_level_options}
                        open={risk !== null}
                        onOpenChange={(open) => !open && setRisk(null)}
                    />
                </>
            )}
            {props.project_can.steer && (
                <>
                    <DirectionDialog
                        key={direction?.updateId ?? 'general'}
                        project={project}
                        updateId={direction?.updateId}
                        context={direction?.context}
                        open={direction !== null}
                        onOpenChange={(open) => !open && setDirection(null)}
                    />
                    <RequestUpdateDialog
                        project={project}
                        leadName={props.project.lead?.name}
                        open={requestOpen}
                        onOpenChange={setRequestOpen}
                    />
                </>
            )}
        </>
    );

    return {
        dialogs,
        resolving,
        resolve,
        openUpdate: () => setUpdateOpen(true),
        openMilestone: (value: MilestoneDetail | 'new') => setMilestone(value),
        openRisk: (value: RiskItem | 'new') => setRisk(value),
        openDirection: (update: ProjectUpdateItem | null = null) =>
            setDirection({
                updateId: update?.id ?? null,
                context: update?.decision_needed ?? update?.summary ?? null,
            }),
        openRequest: () => setRequestOpen(true),
    };
}

export type ProjectSummaryActions = ReturnType<typeof useProjectSummary>;
