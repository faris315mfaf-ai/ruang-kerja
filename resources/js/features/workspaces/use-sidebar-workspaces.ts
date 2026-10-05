import { usePage } from '@inertiajs/react';
import type { SidebarWorkspace } from './types';

/** Shared prop `workspaces` (HandleInertiaRequests, SidebarWorkspaces). */
export function useSidebarWorkspaces(): SidebarWorkspace[] {
    const { props } = usePage<{ workspaces?: SidebarWorkspace[] }>();

    return props.workspaces ?? [];
}

/** Path prefix of a workspace, e.g. "/w/OPS". */
export function workspacePath(key: string): string {
    return `/w/${key}`;
}
