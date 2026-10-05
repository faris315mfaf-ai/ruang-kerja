import { router } from '@inertiajs/react';
import {
    MoreHorizontal,
    Pencil,
    Plus,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Panel } from '@/components/ui/panel';
import { RISK_LABELS } from '@/features/portfolio/lib';
import type {
    ProjectSummaryProps,
    RiskItem,
    RiskLevel,
} from '@/features/portfolio/types';
import { cn } from '@/lib/utils';
import { destroy as destroyRisk } from '@/routes/projects/risks';

const LEVEL_TONES: Record<RiskLevel, BadgeTone> = {
    high: 'danger',
    medium: 'warning',
    low: 'neutral',
};

/** "Risiko terbuka" (DProyek): open risks first, resolved ones struck through. */
export function RisksPanel({
    props,
    onCreate,
    onEdit,
}: {
    props: ProjectSummaryProps;
    onCreate: () => void;
    onEdit: (risk: RiskItem) => void;
}) {
    const open = props.risks.filter((risk) => risk.status === 'open');
    const resolved = props.risks.filter((risk) => risk.status !== 'open');
    const can = props.project_can;

    const remove = (risk: RiskItem) => {
        if (window.confirm(`Hapus risiko "${risk.title}"?`)) {
            router.delete(
                destroyRisk({ workspace: props.project.key, risk: risk.id })
                    .url,
                { preserveScroll: true },
            );
        }
    };

    return (
        <Panel
            title="Risiko terbuka"
            action={
                <span className="flex items-center gap-3">
                    <span className="text-label font-normal text-text-muted">
                        {open.length} terbuka · {resolved.length} teratasi
                    </span>
                    {can.manage && (
                        <Button variant="tonal" size="sm" onClick={onCreate}>
                            <Plus aria-hidden /> Risiko
                        </Button>
                    )}
                </span>
            }
        >
            {props.risks.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={ShieldCheck}
                    title="Tidak ada risiko tercatat"
                />
            ) : (
                <ul className="flex flex-col">
                    {[...open, ...resolved].map((risk) => {
                        const done = risk.status !== 'open';

                        return (
                            <li
                                key={risk.id}
                                className="flex items-start gap-3 border-t border-divider py-3"
                            >
                                <Badge
                                    variant="label"
                                    tone={LEVEL_TONES[risk.level]}
                                    className="h-7 px-2.5"
                                >
                                    {RISK_LABELS[risk.level]}
                                </Badge>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span
                                        className={cn(
                                            'text-[16px] font-semibold',
                                            done &&
                                                'text-text-muted line-through',
                                        )}
                                    >
                                        {risk.title}
                                        {risk.task && (
                                            <span className="ml-1.5 font-mono text-[13px] whitespace-nowrap text-link no-underline">
                                                {risk.task.code}
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-meta text-text-muted">
                                        {risk.owner?.name ?? 'Tanpa pemilik'} ·{' '}
                                        {done ? 'teratasi' : 'terbuka'}
                                    </span>
                                </span>
                                {can.manage && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="-my-1.5 shrink-0"
                                                aria-label={`Aksi risiko ${risk.title}`}
                                            >
                                                <MoreHorizontal />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onSelect={() => onEdit(risk)}
                                            >
                                                <Pencil /> Ubah / tandai
                                                teratasi
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-danger"
                                                onSelect={() => remove(risk)}
                                            >
                                                <Trash2 /> Hapus
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
