/** Shapes of App\Domain\Organization\Data\Org* (OrganizationTree). */
export type OrgPerson = {
    id: string;
    name: string;
    avatar: string | null;
    position: string | null;
    level: number | null;
    managerId: string | null;
    roles: string[];
};

export type OrgTeam = {
    id: string;
    name: string;
    code: string | null;
    lead: OrgPerson | null;
    /** Team members without the lead. */
    members: OrgPerson[];
    /** Active employees in the team (lead included when a member). */
    size: number;
};

export type OrgDivision = {
    id: string;
    name: string;
    code: string;
    isBoard: boolean;
    head: OrgPerson | null;
    teams: OrgTeam[];
    /** Members without a team, head excluded. */
    members: OrgPerson[];
    /** Active employees of this division (head included when a member). */
    size: number;
    children: OrgDivision[];
};

export type OrgChart = {
    companyName: string;
    board: OrgDivision | null;
    divisions: OrgDivision[];
    unassigned: OrgPerson[];
    stats: { divisions: number; teams: number; people: number };
};
