import { router, usePage } from '@inertiajs/react';
import { Bookmark, Check, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toolbarControl } from '../lib/toolbar';
import views from '@/routes/workspaces/views';
import { ApiError, requestJson } from '../lib/api';
import type { TaskFilters } from '../lib/filters';
import type { SavedView, TaskViewMode } from '../types';
import { isCurrentView, savedViewUrl } from './saved-views';

type Props = {
    workspaceKey: string;
    savedViews: SavedView[];
    layout: TaskViewMode;
    filters: TaskFilters;
    /** May share views with the workspace (task edit rights). */
    canShare: boolean;
    /** Workspace admin: may remove shared views of others. */
    canManage: boolean;
    mobile?: boolean;
};

/**
 * "Tampilan" menu: apply, save (personal or shared with the workspace) and
 * delete saved views (filters + layout).
 */
export function SavedViewsMenu({
    workspaceKey,
    savedViews,
    layout,
    filters,
    canShare,
    canManage,
    mobile = false,
}: Props) {
    const { auth } = usePage().props;
    const viewerId = auth.user?.id;
    const [dialog, setDialog] = useState(false);
    const [name, setName] = useState('');
    const [shared, setShared] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const active = savedViews.find((view) =>
        isCurrentView(view, layout, filters, viewerId),
    );
    const personal = savedViews.filter((view) => !view.is_shared);
    const team = savedViews.filter((view) => view.is_shared);
    const base = `/w/${workspaceKey}`;

    const save = async () => {
        setSaving(true);
        setError(null);

        try {
            await requestJson(views.store(workspaceKey), {
                name,
                layout,
                filters,
                is_shared: shared,
            });
            toast.success(`Tampilan “${name.trim()}” disimpan.`);
            setDialog(false);
            setName('');
            setShared(false);
            router.reload({ only: ['saved_views'] });
        } catch (failure) {
            setError(
                failure instanceof ApiError
                    ? failure.message
                    : 'Tampilan gagal disimpan.',
            );
        } finally {
            setSaving(false);
        }
    };

    const remove = async (view: SavedView) => {
        try {
            await requestJson(
                views.destroy({ workspace: workspaceKey, view: view.id }),
            );
            toast.success(`Tampilan “${view.name}” dihapus.`);
            router.reload({ only: ['saved_views'] });
        } catch (failure) {
            toast.error(
                failure instanceof ApiError
                    ? failure.message
                    : 'Tampilan gagal dihapus.',
            );
        }
    };

    const item = (view: SavedView) => (
        <DropdownMenuItem
            key={view.id}
            onSelect={() => router.visit(savedViewUrl(base, view, viewerId))}
            className="group"
        >
            {view === active ? (
                <Check aria-hidden />
            ) : (
                <span className="size-4" />
            )}
            <span className="min-w-0 flex-1 truncate">
                {view.name}
                {view.owner && (
                    <span className="ml-1 text-xs text-text-muted">
                        · {view.owner.split(' ')[0]}
                    </span>
                )}
            </span>
            {(view.mine || (view.is_shared && canManage)) && (
                <button
                    type="button"
                    aria-label={`Hapus tampilan ${view.name}`}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void remove(view);
                    }}
                    className="flex size-6 items-center justify-center rounded text-text-muted opacity-0 group-hover:opacity-100 group-focus:opacity-100 hover:text-danger"
                >
                    <Trash2 className="size-3.5" aria-hidden />
                </button>
            )}
        </DropdownMenuItem>
    );

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={
                            active
                                ? `Tampilan: ${active.name}`
                                : 'Tampilan tersimpan'
                        }
                        className={cn(
                            toolbarControl,
                            mobile && 'size-11 justify-center px-0',
                            active && 'border-primary/50 text-link',
                        )}
                    >
                        <Bookmark strokeWidth={2} aria-hidden />
                        {!mobile && (
                            <span className="max-w-40 truncate">
                                {active?.name ?? 'Tampilan'}
                            </span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    {savedViews.length === 0 && (
                        <p className="px-2 py-2 text-[13px] text-text-muted">
                            Belum ada tampilan tersimpan. Atur filter & tata
                            letak lalu simpan.
                        </p>
                    )}
                    {personal.length > 0 && (
                        <>
                            <DropdownMenuLabel className="text-xs text-text-muted">
                                Pribadi
                            </DropdownMenuLabel>
                            {personal.map(item)}
                        </>
                    )}
                    {team.length > 0 && (
                        <>
                            {personal.length > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-text-muted">
                                <Users className="size-3.5" aria-hidden />
                                Dibagikan ke workspace
                            </DropdownMenuLabel>
                            {team.map(item)}
                        </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setDialog(true)}>
                        <Plus aria-hidden />
                        Simpan tampilan ini…
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={dialog} onOpenChange={setDialog}>
                <DialogContent className="bg-surface sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Simpan tampilan</DialogTitle>
                        <DialogDescription>
                            Filter dan tata letak saat ini disimpan dengan nama
                            ini.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void save();
                        }}
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="saved-view-name">Nama</Label>
                            <Input
                                id="saved-view-name"
                                value={name}
                                maxLength={60}
                                placeholder="mis. Tenggat minggu ini"
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                autoFocus
                            />
                            {error && (
                                <p className="text-xs text-danger">{error}</p>
                            )}
                        </div>
                        {canShare && (
                            <label className="flex items-center gap-2 text-[13px] text-text">
                                <Checkbox
                                    checked={shared}
                                    onCheckedChange={(value) =>
                                        setShared(value === true)
                                    }
                                />
                                Bagikan ke semua anggota workspace
                            </label>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDialog(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving || name.trim() === ''}
                            >
                                {saving ? 'Menyimpan…' : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
