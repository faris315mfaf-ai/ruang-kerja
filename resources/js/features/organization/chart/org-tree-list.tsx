import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CodeBadge, PersonRow, TeamBadge } from './person-row';
import type { OrgChart, OrgDivision, OrgTeam } from './types';
import { divisionTone, headSubtitle } from './utils';

type Context = {
    viewerId: string | null;
    viewerDivisionId: string | null;
    /** Search active: everything left after filtering starts open. */
    expandAll: boolean;
};

/**
 * Nested accordion list of the org structure: the mobile layout of
 * /organisasi/struktur (docs/PLATFORM.md §3) and the "Daftar" view on desktop.
 */
export function OrgTreeList({
    chart,
    ...context
}: Context & { chart: OrgChart }) {
    return (
        <div className="space-y-4">
            {chart.board && (
                <section
                    aria-label={chart.board.name}
                    className="overflow-hidden rounded-lg border border-border bg-surface"
                >
                    <h2 className="border-b border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text">
                        {chart.board.name}
                        <span className="ml-2 text-xs font-normal text-text-muted">
                            {chart.board.size} orang
                        </span>
                    </h2>
                    <ul className="divide-y divide-border">
                        {[
                            ...(chart.board.head ? [chart.board.head] : []),
                            ...chart.board.members,
                        ].map((person) => (
                            <li key={person.id} className="px-4 py-2.5">
                                <PersonRow
                                    person={person}
                                    isYou={person.id === context.viewerId}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {chart.divisions.length > 0 && (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                    {chart.divisions.map((division, index) => (
                        <DivisionItem
                            key={division.id}
                            division={division}
                            toneIndex={index}
                            {...context}
                        />
                    ))}
                </ul>
            )}

            {chart.unassigned.length > 0 && (
                <section
                    aria-label="Tanpa divisi"
                    className="rounded-lg border border-dashed border-border-strong bg-surface"
                >
                    <h2 className="px-4 pt-3 text-[13px] font-medium text-text-muted">
                        Tanpa divisi · {chart.unassigned.length} orang
                    </h2>
                    <ul className="divide-y divide-border">
                        {chart.unassigned.map((person) => (
                            <li key={person.id} className="px-4 py-2.5">
                                <PersonRow
                                    person={person}
                                    isYou={person.id === context.viewerId}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

function Disclosure({
    defaultOpen,
    summary,
    children,
    className,
}: {
    defaultOpen: boolean;
    summary: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={className}>
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
                <ChevronRight
                    aria-hidden
                    className={cn(
                        'size-4 shrink-0 text-text-subtle transition-transform duration-180 ease-brand',
                        open && 'rotate-90',
                    )}
                />
                {summary}
            </button>
            {open && children}
        </div>
    );
}

function DivisionItem({
    division,
    toneIndex,
    depth = 0,
    ...context
}: Context & {
    division: OrgDivision;
    toneIndex: number;
    depth?: number;
}) {
    const tone = divisionTone(toneIndex);
    const contains =
        context.viewerDivisionId === division.id ||
        division.head?.id === context.viewerId;

    return (
        <li>
            <Disclosure
                defaultOpen={context.expandAll || contains}
                summary={
                    <>
                        <span
                            aria-hidden
                            className={cn(
                                'h-8 w-1 shrink-0 rounded-full',
                                tone.dot,
                            )}
                        />
                        <span className="grid min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span className="truncate text-[15px] font-medium text-text">
                                    {division.name}
                                </span>
                                <CodeBadge code={division.code} />
                            </span>
                            <span className="truncate text-[13px] text-text-muted">
                                {division.head
                                    ? division.head.name
                                    : 'Belum ada kepala divisi'}
                            </span>
                        </span>
                        <span className="shrink-0 text-[13px] text-text-muted tabular-nums">
                            {division.size} orang
                        </span>
                    </>
                }
            >
                <div
                    className={cn(
                        'space-y-3 border-t border-border bg-surface-2/50 py-3 pr-4',
                        depth === 0 ? 'pl-11' : 'pl-6',
                    )}
                >
                    {division.head && (
                        <PersonRow
                            person={division.head}
                            subtitle={headSubtitle(division.head, false)}
                            isYou={division.head.id === context.viewerId}
                        />
                    )}

                    {division.teams.map((team) => (
                        <TeamItem key={team.id} team={team} {...context} />
                    ))}

                    {division.members.length > 0 && (
                        <div>
                            {division.teams.length > 0 && (
                                <h4 className="mb-2 text-xs font-medium text-text-muted">
                                    Tanpa tim · {division.members.length} orang
                                </h4>
                            )}
                            <ul className="space-y-2.5">
                                {division.members.map((person) => (
                                    <li key={person.id}>
                                        <PersonRow
                                            person={person}
                                            isYou={
                                                person.id === context.viewerId
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {division.children.length > 0 && (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                            {division.children.map((child, index) => (
                                <DivisionItem
                                    key={child.id}
                                    division={child}
                                    toneIndex={toneIndex + index + 1}
                                    depth={depth + 1}
                                    {...context}
                                />
                            ))}
                        </ul>
                    )}

                    {!division.head &&
                        division.teams.length === 0 &&
                        division.members.length === 0 &&
                        division.children.length === 0 && (
                            <p className="text-[13px] text-text-muted">
                                Belum ada anggota.
                            </p>
                        )}
                </div>
            </Disclosure>
        </li>
    );
}

function TeamItem({
    team,
    viewerId,
    expandAll,
}: Pick<Context, 'viewerId' | 'expandAll'> & { team: OrgTeam }) {
    const contains =
        team.lead?.id === viewerId ||
        team.members.some((member) => member.id === viewerId);

    return (
        <Disclosure
            defaultOpen={expandAll || contains}
            className="overflow-hidden rounded-lg border border-border bg-surface [&>button]:min-h-12 [&>button]:px-3"
            summary={
                <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                        {team.name}
                        {team.code && (
                            <span className="ml-2 font-mono text-[11px] font-normal text-text-muted">
                                {team.code}
                            </span>
                        )}
                    </span>
                    <span className="shrink-0 text-[13px] text-text-muted tabular-nums">
                        {team.size} orang
                    </span>
                </>
            }
        >
            <ul className="space-y-2.5 border-t border-border px-3 py-2.5">
                {team.lead && (
                    <li>
                        <PersonRow
                            person={team.lead}
                            isYou={team.lead.id === viewerId}
                            trailing={<TeamBadge />}
                        />
                    </li>
                )}
                {team.members.map((member) => (
                    <li key={member.id}>
                        <PersonRow
                            person={member}
                            isYou={member.id === viewerId}
                        />
                    </li>
                ))}
                {!team.lead && team.members.length === 0 && (
                    <li className="text-[13px] text-text-muted">
                        Belum ada anggota.
                    </li>
                )}
            </ul>
        </Disclosure>
    );
}
