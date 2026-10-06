import { Clock, LayoutTemplate, ListChecks, Trash2 } from 'lucide-react';
import { PRIORITY_LABELS, PriorityIcon } from '@/components/priority-icon';
import { StatusIcon } from '@/components/status-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
    LabelRef,
    TaskTemplate,
    WorkspaceTemplate,
} from '@/features/automation/types';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

export function LabelChip({ label }: { label: LabelRef }) {
    const tone = palette(label.color);

    return (
        <span
            className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[13px] font-semibold',
                tone.soft,
                tone.text,
            )}
        >
            <span aria-hidden className={cn('size-2 rounded-full', tone.bg)} />
            {label.name}
        </span>
    );
}

const CARD =
    'flex min-w-0 flex-col gap-3 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6';

function CardHead({
    icon,
    name,
    used,
    tile,
}: {
    icon: typeof ListChecks;
    name: string;
    used: number;
    tile: string;
}) {
    const Icon = icon;

    return (
        <div className="flex items-start gap-3">
            <span
                aria-hidden
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-[14px] text-on-brand',
                    tile,
                )}
            >
                <Icon className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
                <h3 className="text-title text-text">{name}</h3>
                <p className="text-meta text-text-muted tnum">
                    Dipakai {used}×
                </p>
            </div>
        </div>
    );
}

export function TaskTemplateCard({
    template,
    workspaceKey,
    onUse,
    onDelete,
}: {
    template: TaskTemplate;
    /** Key of the workspace a workspace-only template belongs to. */
    workspaceKey?: string;
    /** Null when the person cannot use it in any workspace. */
    onUse: (() => void) | null;
    onDelete?: () => void;
}) {
    const shown = template.checklist.slice(0, 3);
    const rest = template.checklist.length - shown.length;

    return (
        <article className={CARD}>
            <CardHead
                icon={ListChecks}
                name={template.name}
                used={template.used_count}
                tile="bg-grad-merek"
            />
            {template.description && (
                <p className="text-[15px] leading-[22px] text-text-muted">
                    {template.description}
                </p>
            )}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-text-muted">
                <Badge variant="label">
                    {workspaceKey ? `Hanya ${workspaceKey}` : 'Semua workspace'}
                </Badge>
                <span className="inline-flex items-center gap-1.5">
                    <PriorityIcon
                        priority={template.priority}
                        labelled={false}
                    />
                    {PRIORITY_LABELS[template.priority]}
                </span>
                <span className="inline-flex items-center gap-1.5 tnum">
                    <Clock aria-hidden className="size-4" />
                    {template.estimate_hours === null
                        ? 'Tanpa estimasi'
                        : `${template.estimate_hours.toLocaleString('id-ID')} jam`}
                </span>
                <span className="inline-flex items-center gap-1.5 tnum">
                    <ListChecks aria-hidden className="size-4" />
                    {template.checklist.length} butir
                </span>
            </p>
            {shown.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3.5 py-3 text-[14px] text-text">
                    {shown.map((item) => (
                        <li key={item} className="flex gap-2">
                            <span
                                aria-hidden
                                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-text-subtle"
                            />
                            <span className="min-w-0 truncate">{item}</span>
                        </li>
                    ))}
                    {rest > 0 && (
                        <li className="pl-3.5 text-text-muted">+{rest} lagi</li>
                    )}
                </ul>
            )}
            {template.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {template.labels.map((label) => (
                        <LabelChip key={label.id} label={label} />
                    ))}
                </div>
            )}
            <CardActions
                name={template.name}
                onUse={onUse}
                onDelete={onDelete}
                blockedNote="Anda tidak bisa membuat tugas di workspace mana pun."
            />
        </article>
    );
}

/** "Pakai template" + delete, at the bottom of a card. */
function CardActions({
    name,
    onUse,
    onDelete,
    blockedNote,
}: {
    name: string;
    onUse: (() => void) | null;
    onDelete?: () => void;
    blockedNote: string;
}) {
    return (
        <div className="mt-auto flex flex-wrap items-center gap-2">
            {onUse ? (
                <Button
                    variant="tonal"
                    onClick={onUse}
                    className="h-12 flex-1 md:h-11 md:flex-none"
                    aria-label={`Pakai template ${name}`}
                >
                    Pakai template
                </Button>
            ) : (
                <p className="flex-1 text-meta text-text-muted">
                    {blockedNote}
                </p>
            )}
            {onDelete && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    aria-label={`Hapus template ${name}`}
                    className="ml-auto"
                >
                    <Trash2 aria-hidden />
                </Button>
            )}
        </div>
    );
}

export function WorkspaceTemplateCard({
    template,
    onUse,
    onDelete,
}: {
    template: WorkspaceTemplate;
    /** Null when the person may not create a workspace of this type. */
    onUse: (() => void) | null;
    onDelete?: () => void;
}) {
    return (
        <article className={CARD}>
            <CardHead
                icon={LayoutTemplate}
                name={template.name}
                used={template.used_count}
                tile={
                    template.type === 'project'
                        ? 'bg-grad-indigo'
                        : 'bg-grad-aksi'
                }
            />
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="label">
                    {template.type === 'project' ? 'Proyek' : 'Tim'}
                </Badge>
                <span className="text-meta text-text-muted tnum">
                    {template.statuses.length} kolom · {template.labels.length}{' '}
                    label
                </span>
            </div>
            {template.description && (
                <p className="text-[15px] leading-[22px] text-text-muted">
                    {template.description}
                </p>
            )}
            <ol
                aria-label="Kolom status"
                className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3.5 py-3"
            >
                {template.statuses.map((status) => (
                    <li
                        key={status.name}
                        className="flex items-center gap-2 text-[14px] text-text"
                    >
                        <StatusIcon
                            category={status.category}
                            color={status.color}
                        />
                        {status.name}
                    </li>
                ))}
            </ol>
            <div className="flex flex-wrap gap-1.5">
                {template.labels.map((label) => (
                    <LabelChip key={label.id} label={label} />
                ))}
            </div>
            <CardActions
                name={template.name}
                onUse={onUse}
                onDelete={onDelete}
                blockedNote={
                    template.type === 'project'
                        ? 'Proyek dibuat oleh Kepala Divisi, Ketua Tim, atau Direksi.'
                        : 'Workspace tim dibuat oleh Kepala Divisi atau Ketua Tim.'
                }
            />
        </article>
    );
}
