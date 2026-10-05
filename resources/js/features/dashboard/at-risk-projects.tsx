import { Link } from '@inertiajs/react';
import { AlertTriangle, Clock } from 'lucide-react';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectAtRisk } from '@/types/dashboard';
import { PanelEmpty } from './panel';

const HEALTH = {
    off_track: 'bg-danger/10 text-danger',
    at_risk: 'bg-warning/12 text-warning',
    on_track: 'bg-success/10 text-success',
} as const;

/**
 * Project workspaces involving the people in scope that need attention:
 * PIC health "Berisiko"/"Bermasalah" or no project update for over 7 days.
 */
export function AtRiskProjects({ projects }: { projects: ProjectAtRisk[] }) {
    if (projects.length === 0) {
        return <PanelEmpty>Semua proyek sesuai jalur.</PanelEmpty>;
    }

    return (
        <ul className="divide-y divide-border">
            {projects.map((project) => (
                <li key={project.id}>
                    <Link
                        href={project.url}
                        className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    >
                        <span className="w-12 shrink-0 font-mono text-xs text-text-muted">
                            {project.key}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-text">
                            {project.name}
                            {project.lead && (
                                <span className="text-text-muted">
                                    {' '}
                                    · PIC {project.lead}
                                </span>
                            )}
                        </span>
                        {project.health && project.health_label && (
                            <span
                                className={cn(
                                    'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium',
                                    HEALTH[project.health],
                                )}
                            >
                                <AlertTriangle
                                    className="size-3.5"
                                    aria-hidden
                                />
                                {project.health_label}
                            </span>
                        )}
                        {project.stale && (
                            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-2 px-2 text-xs text-text-muted">
                                <Clock className="size-3.5" aria-hidden />
                                {project.last_update_at
                                    ? `Update ${formatRelative(project.last_update_at)}`
                                    : 'Belum ada update'}
                            </span>
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}
