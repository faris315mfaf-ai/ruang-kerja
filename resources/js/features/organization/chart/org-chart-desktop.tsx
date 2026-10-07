import { ChevronDown, Maximize, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AvatarStack, CodeBadge, PersonRow, TeamBadge } from './person-row';
import type { OrgChart, OrgDivision, OrgPerson, OrgTeam } from './types';
import { divisionTone, headSubtitle, teamCountLabel } from './utils';
import type { DivisionTone } from './utils';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;
const BOARD_VISIBLE = 3;

type Context = {
    viewerId: string | null;
    viewerDivisionId: string | null;
    /** Search active: open everything that is left after filtering. */
    expandAll: boolean;
    /** PNG export: everything open, no toggles (pair with expandAll). */
    printable?: boolean;
};

type Props = Context & {
    chart: OrgChart;
    /** Shown at the bottom-left of the canvas (source note + link). */
    footer?: ReactNode;
};

/** Connector colour shared by all chart lines. */
const LINE = 'border-border-strong';

function clampZoom(value: number): number {
    return Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Math.round(value * 100) / 100),
    );
}

/**
 * Desktop org chart (mockup StrukturOrg): Direksi on top, one column per
 * division with its teams and members below. Pure React/CSS; zoomable.
 */
export function OrgChartDesktop({ chart, footer, ...context }: Props) {
    const viewport = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);

    const fit = useCallback(() => {
        if (!viewport.current || !content.current) {
            return;
        }

        const natural = content.current.getBoundingClientRect().width / zoom;
        const available = viewport.current.clientWidth - 48;

        setZoom(clampZoom(Math.min(1, available / natural)));
    }, [zoom]);

    return (
        <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
            <div
                ref={viewport}
                className="overflow-auto bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] p-6"
            >
                <div ref={content} className="mx-auto w-max" style={{ zoom }}>
                    <OrgChartCanvas chart={chart} {...context} />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
                <div className="text-label font-normal text-text-muted">
                    {footer}
                </div>
                <div
                    role="group"
                    aria-label="Perbesar atau perkecil bagan"
                    className="flex items-center gap-1 rounded-control border border-border bg-surface p-1"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Perkecil"
                        disabled={zoom <= MIN_ZOOM}
                        onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
                    >
                        <Minus />
                    </Button>
                    <span
                        className="w-12 text-center text-label font-normal text-text tabular-nums"
                        aria-live="polite"
                    >
                        {formatPercent(zoom * 100, 0)}
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Perbesar"
                        disabled={zoom >= MAX_ZOOM}
                        onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
                    >
                        <Plus />
                    </Button>
                    <span
                        aria-hidden
                        className="mx-1 h-4 border-l border-border"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-label font-normal"
                        onClick={fit}
                    >
                        <Maximize />
                        Pas ke layar
                    </Button>
                </div>
            </div>
        </div>
    );
}

/**
 * The chart itself (Direksi, division columns, people without a division),
 * shared by the zoomable view and the PNG export (`printable`).
 */
export function OrgChartCanvas({
    chart,
    ...context
}: Context & { chart: OrgChart }) {
    return (
        <>
            {chart.board && <BoardCard board={chart.board} {...context} />}
            {chart.board && chart.divisions.length > 0 && (
                <span
                    aria-hidden
                    className={cn('mx-auto block h-6 w-0 border-l', LINE)}
                />
            )}

            {chart.divisions.length > 0 && (
                <div className="flex justify-center">
                    {chart.divisions.map((division, index) => (
                        <div
                            key={division.id}
                            className={cn(
                                'relative px-2',
                                chart.board && 'pt-8',
                            )}
                        >
                            {chart.board && (
                                <>
                                    {index > 0 && (
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'absolute top-0 left-0 w-1/2 border-t',
                                                LINE,
                                            )}
                                        />
                                    )}
                                    {index < chart.divisions.length - 1 && (
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'absolute top-0 right-0 w-1/2 border-t',
                                                LINE,
                                            )}
                                        />
                                    )}
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'absolute top-0 left-1/2 h-8 border-l',
                                            LINE,
                                        )}
                                    />
                                </>
                            )}
                            <DivisionColumn
                                division={division}
                                tone={divisionTone(index)}
                                {...context}
                            />
                        </div>
                    ))}
                </div>
            )}

            {chart.unassigned.length > 0 && (
                <section
                    aria-label="Tanpa divisi"
                    className="mx-auto mt-10 w-[248px] rounded-lg border border-dashed border-border-strong bg-surface p-3"
                >
                    <h3 className="mb-2 text-meta font-semibold text-text-muted">
                        Tanpa divisi · {chart.unassigned.length} orang
                    </h3>
                    <div className="space-y-2">
                        {chart.unassigned.map((person) => (
                            <PersonRow
                                key={person.id}
                                person={person}
                                size="sm"
                                isYou={person.id === context.viewerId}
                            />
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}

function BoardCard({
    board,
    viewerId,
    printable = false,
}: Context & {
    board: OrgDivision;
}) {
    const [expanded, setShowAll] = useState(false);
    const showAll = expanded || printable;
    const people = [
        ...(board.head ? [board.head] : []),
        ...board.members,
        ...board.teams.flatMap((team) => [
            ...(team.lead ? [team.lead] : []),
            ...team.members,
        ]),
    ];
    const visible = showAll ? people : people.slice(0, BOARD_VISIBLE);
    const hidden = people.length - visible.length;

    return (
        <section
            aria-label={board.name}
            className="relative mx-auto w-fit max-w-[760px] min-w-[460px] overflow-hidden rounded-card border border-border bg-surface shadow-card"
        >
            <header className="flex items-center justify-between gap-6 border-b border-border bg-background px-4 py-3">
                <h2 className="text-[16px] font-bold text-text">
                    {board.name}
                    <span className="ml-2 text-meta font-normal text-text-muted">
                        {board.size} orang
                    </span>
                </h2>
                {!printable &&
                    (hidden > 0 || showAll) &&
                    people.length > BOARD_VISIBLE && (
                        <button
                            type="button"
                            onClick={() => setShowAll((value) => !value)}
                            className="rounded text-meta text-text-muted hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                        >
                            {showAll ? 'Ringkas' : `+${hidden} lainnya`}
                        </button>
                    )}
            </header>
            {visible.length > 0 ? (
                <div
                    className={cn(
                        'grid',
                        printable && visible.length > BOARD_VISIBLE
                            ? // Three per row so a long Direksi stays inside the card.
                              'grid-cols-3 [&>*]:border-divider [&>*:not(:nth-child(3n+1))]:border-l [&>*:nth-child(n+4)]:border-t'
                            : 'auto-cols-fr grid-flow-col divide-x divide-divider',
                    )}
                >
                    {visible.map((person) => (
                        <PersonRow
                            key={person.id}
                            person={person}
                            isYou={person.id === viewerId}
                            className="min-w-[200px] px-4 py-3"
                        />
                    ))}
                </div>
            ) : (
                <p className="px-4 py-3 text-meta text-text-muted">
                    Belum ada anggota Direksi.
                </p>
            )}
        </section>
    );
}

/** One branch item hanging off a division column, with its tree connector. */
function Branch({ children, last }: { children: ReactNode; last: boolean }) {
    return (
        <li className="relative pt-3 pl-4">
            <span
                aria-hidden
                className={cn(
                    'absolute top-0 left-0 border-l',
                    LINE,
                    last ? 'h-8' : 'h-full',
                )}
            />
            <span
                aria-hidden
                className={cn('absolute top-8 left-0 w-4 border-t', LINE)}
            />
            {children}
        </li>
    );
}

function DivisionColumn({
    division,
    tone,
    nested = false,
    ...context
}: Context & {
    division: OrgDivision;
    tone: DivisionTone;
    nested?: boolean;
}) {
    const isMine = context.viewerDivisionId === division.id;
    const [membersOpen, setMembersOpen] = useState(isMine);
    const open = membersOpen || context.expandAll;
    const hasTeams = division.teams.length > 0;
    const items: ReactNode[] = [];

    division.teams.forEach((team) => {
        items.push(<TeamCard key={team.id} team={team} {...context} />);
    });

    if (division.members.length > 0) {
        if (hasTeams || !open) {
            items.push(
                <MembersSummary
                    key="members"
                    members={division.members}
                    label={
                        hasTeams
                            ? 'Staf tanpa tim'
                            : `${division.members.length} anggota`
                    }
                    open={open}
                    onToggle={() => setMembersOpen((value) => !value)}
                    viewerId={context.viewerId}
                    inline={hasTeams}
                    printable={context.printable}
                />,
            );
        } else {
            division.members.forEach((person) => {
                items.push(
                    <div
                        key={person.id}
                        className="rounded-card border border-border bg-surface px-3.5 py-2.5 shadow-card"
                    >
                        <PersonRow
                            person={person}
                            size="sm"
                            isYou={person.id === context.viewerId}
                        />
                    </div>,
                );
            });
        }
    }

    division.children.forEach((child, index) => {
        items.push(
            <DivisionColumn
                key={child.id}
                division={child}
                tone={divisionTone(index + 1)}
                nested
                {...context}
            />,
        );
    });

    const collapseButton =
        !hasTeams && open && division.members.length > 0 && !context.expandAll;

    return (
        <div className={nested ? 'w-full' : 'w-[248px]'}>
            <section
                aria-label={`Divisi ${division.name}`}
                className={cn(
                    'rounded-lg border border-t-[3px] border-border bg-surface shadow-card',
                    tone.bar,
                )}
            >
                <header className="flex items-start justify-between gap-2 px-3.5 pt-3">
                    <h3 className="text-[16px] font-bold text-text">
                        {division.name}
                    </h3>
                    <CodeBadge code={division.code} />
                </header>
                <div className="px-3.5 py-3">
                    {division.head ? (
                        <PersonRow
                            person={division.head}
                            subtitle={headSubtitle(division.head, false)}
                            isYou={division.head.id === context.viewerId}
                        />
                    ) : (
                        <p className="text-meta text-text-muted">
                            Belum ada kepala divisi
                        </p>
                    )}
                </div>
                <footer className="flex items-center justify-between px-3.5 pb-3 text-meta text-text-muted">
                    <span>{division.size} orang</span>
                    <span>{teamCountLabel(division.teams.length)}</span>
                </footer>
            </section>

            {items.length > 0 && (
                <ul className="ml-5">
                    {items.map((item, index) => (
                        <Branch key={index} last={index === items.length - 1}>
                            {item}
                        </Branch>
                    ))}
                </ul>
            )}

            {collapseButton && (
                <button
                    type="button"
                    onClick={() => setMembersOpen(false)}
                    className="mt-2 ml-9 rounded text-meta text-text-muted hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                >
                    Ringkas
                </button>
            )}
        </div>
    );
}

function TeamCard({
    team,
    viewerId,
    expandAll,
    printable = false,
}: Pick<Context, 'viewerId' | 'expandAll' | 'printable'> & { team: OrgTeam }) {
    const containsViewer =
        team.lead?.id === viewerId ||
        team.members.some((member) => member.id === viewerId);
    const [membersOpen, setMembersOpen] = useState(containsViewer);
    const open = membersOpen || expandAll;
    const initial = team.name
        .replace(/^tim\s+/i, '')
        .charAt(0)
        .toUpperCase();
    const everyone = [...(team.lead ? [team.lead] : []), ...team.members];

    return (
        <div className="rounded-card border border-border bg-surface p-3.5 shadow-card">
            <div className="flex items-center gap-2">
                <span
                    aria-hidden
                    className="flex size-5 shrink-0 items-center justify-center rounded-xs bg-info-soft text-[12px] font-bold text-info"
                >
                    {initial}
                </span>
                <h4 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">
                    {team.name}
                </h4>
                {team.code && (
                    <span className="font-mono text-[12px] text-text-muted">
                        {team.code}
                    </span>
                )}
            </div>
            {team.lead && (
                <PersonRow
                    person={team.lead}
                    size="sm"
                    subtitle={null}
                    isYou={team.lead.id === viewerId}
                    trailing={<TeamBadge />}
                    className="mt-2.5"
                />
            )}
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setMembersOpen((value) => !value)}
                disabled={team.members.length === 0}
                className="mt-2.5 flex w-full items-center gap-2 rounded-xs text-left text-[14px] whitespace-nowrap text-text-muted hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:hover:text-text-muted"
            >
                <AvatarStack people={everyone} total={team.size} />
                <span className="flex-1">{team.size} orang</span>
                {team.members.length > 0 && !printable && (
                    <ChevronDown
                        aria-hidden
                        className={cn(
                            'size-4 transition-transform duration-180 ease-brand',
                            open && 'rotate-180',
                        )}
                    />
                )}
            </button>
            {open && team.members.length > 0 && (
                <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
                    {team.members.map((member) => (
                        <PersonRow
                            key={member.id}
                            person={member}
                            size="sm"
                            isYou={member.id === viewerId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function MembersSummary({
    members,
    label,
    open,
    onToggle,
    viewerId,
    inline,
    printable = false,
}: {
    members: OrgPerson[];
    label: string;
    open: boolean;
    onToggle: () => void;
    viewerId: string | null;
    /** Expand inside the card (division with teams) instead of as cards. */
    inline: boolean;
    /** PNG export: the people are listed below, no avatar preview. */
    printable?: boolean;
}) {
    return (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface">
            <button
                type="button"
                aria-expanded={open}
                onClick={onToggle}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] whitespace-nowrap text-text-muted hover:text-text focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
                {!printable && <AvatarStack people={members} />}
                <span className="flex-1 text-text">{label}</span>
                {inline ? (
                    <span className="tabular-nums">{members.length}</span>
                ) : (
                    <ChevronDown aria-hidden className="size-4" />
                )}
            </button>
            {inline && open && (
                <div className="space-y-2 border-t border-dashed border-border-strong px-3 py-2.5">
                    {members.map((member) => (
                        <PersonRow
                            key={member.id}
                            person={member}
                            size="sm"
                            isYou={member.id === viewerId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
