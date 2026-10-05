import { show } from '@/routes/workspaces';
import type { WorkspacePageProps } from './types';

/** Layout props (breadcrumbs + mobile app bar) for every workspace tab. */
export function workspaceLayout(props: WorkspacePageProps, section?: string) {
    const name =
        props.workspace.type === 'personal' ? 'Pribadi' : props.workspace.name;
    const breadcrumbs = [
        { title: 'Workspace', href: '/workspace' },
        { title: name, href: show.url(props.workspace.key) },
    ];

    return {
        breadcrumbs: section
            ? [...breadcrumbs, { title: section, href: '' }]
            : breadcrumbs,
        title: name,
        back: '/menu',
    };
}
