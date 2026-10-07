/** Props of the Admin › Organisasi page (Organization\*Controller::index). */
export type OrgTab = 'divisi' | 'tim' | 'jabatan';

export type PersonRef = { id: string; name: string; avatar: string | null };

export type DivisionRow = {
    id: string;
    name: string;
    code: string;
    isBoard: boolean;
    parentId: string | null;
    parentName: string | null;
    head: PersonRef | null;
    membersCount: number;
    teamsCount: number;
    childrenCount: number;
    deletedAt: string | null;
};

export type TeamRow = {
    id: string;
    name: string;
    code: string | null;
    divisionId: string;
    divisionName: string;
    divisionCode: string;
    lead: PersonRef | null;
    membersCount: number;
    deletedAt: string | null;
};

export type PositionRow = {
    id: string;
    name: string;
    level: number;
    levelLabel: string;
    /** Job dashboard (/peran/{role}) of the position, set by HR. */
    dashboardRole: string | null;
    dashboardRoleLabel: string | null;
    usersCount: number;
    deletedAt: string | null;
};

export type DivisionOption = {
    value: string;
    label: string;
    code: string;
    isBoard: boolean;
};

export type UserOption = {
    value: string;
    label: string;
    description: string | null;
    avatar: string | null;
};

export type LevelOption = { value: number; label: string };

export type OrganizationOptions = {
    divisions: DivisionOption[];
    users: UserOption[];
    levels: LevelOption[];
    /** Job dashboards; empty while FEATURE_ROLE_DASHBOARDS is off (field hidden). */
    dashboardRoles: { value: string; label: string }[];
};

export type OrganizationAdminProps = {
    tab: OrgTab;
    showDeleted: boolean;
    counts: { divisions: number; teams: number; positions: number };
    options: OrganizationOptions;
    divisions?: DivisionRow[];
    teams?: TeamRow[];
    positions?: PositionRow[];
};
