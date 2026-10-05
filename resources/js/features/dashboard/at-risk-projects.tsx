import { Link } from '@inertiajs/react';
import { Clock, FolderCheck } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import type { ProjectAtRisk } from '@/types/dashboard';

const HEALTH: Record<NonNullable<ProjectAtRisk['health']>, BadgeTone> = {
    off_track: 'danger',
    at_risk: 'warning',
    on_track: 'success',
};

/**
 * Project workspaces involving the people in scope that need attention:
 * PIC health "Berisiko"/"Bermasalah" or no project update for over 7 days.
 */
export function AtRiskProjects({ projects }: { projects: ProjectAtRisk[] }) {
    if (projects.length === 0) {
        return (
            <div className="px-5 pb-2 md:px-7">
                <EmptyState
                    size="sm"
                    icon={FolderCheck}
                    title="Semua proyek sesuai jalur"
                />
            </div>
        );
    }

    return (
        <ul className="divide-y divide-divider border-t border-divider">
            {projects.map((project) => (
                <li key={project.id}>
                    <Link
                        href={project.url}
                        prefetch
                        className={cn(
                            'flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors duration-120 ease-brand hover:bg-background md:px-7',
                            focusRing,
                            'focus-visible:ring-inset',
                        )}
                    >
                        <span className="shrink-0 rounded-sm bg-surface-2 px-2 py-1 font-mono text-[14px] font-semibold">
                            {project.key}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-[17px] font-semibold">
                                {project.name}
                            </span>
                            {project.lead && (
                                <span className="truncate text-label font-normal text-text-muted">
                                    PIC {project.lead}
                                </span>
                            )}
                        </span>
                        <span className="flex flex-wrap gap-2">
                            {project.health && project.health_label && (
                                <Badge
                                    variant="status"
                                    tone={HEALTH[project.health]}
                                    dot
                                    className="h-[30px]"
                                >
                                    {project.health_label}
                                </Badge>
                            )}
                            {project.stale && (
                                <Badge
                                    variant="status"
                                    tone="neutral"
                                    className="h-[30px]"
                                >
                                    <Clock aria-hidden />
                                    {project.last_update_at
                                        ? `Update ${formatRelative(project.last_update_at)}`
                                        : 'Belum ada update'}
                                </Badge>
                            )}
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
