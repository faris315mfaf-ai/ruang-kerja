<?php

namespace App\Domain\Notes\Queries;

use App\Domain\Notes\Enums\NotePreset;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Policies\NotePolicy;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Props of /catatan and /catatan/{note} in the shapes of
 * resources/js/features/notes/types.ts. Lists always go through
 * Note::visibleTo(); `yjs_state` never leaves the server. A fixed number of
 * queries regardless of the number of notes.
 */
final class NoteLibrary
{
    public const int VERSION_LIMIT = 50;

    public const int SEARCH_LIMIT = 200;

    public function __construct(private readonly NotePolicy $policy) {}

    /**
     * Active people of the company (names, avatars, share dialog).
     *
     * @return list<array{id: string, name: string, avatar: string|null, title: string}>
     */
    public function people(User $viewer): array
    {
        return array_values(User::query()
            ->where('company_id', $viewer->company_id)
            ->where('status', UserStatus::Active)
            ->with('position:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_url', 'position_id', 'company_id'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'avatar' => $user->avatar_url,
                'title' => $user->position->name ?? '',
            ])
            ->all());
    }

    /**
     * Visible notes (tree rows, no content), optionally of one workspace.
     *
     * @return list<array<string, mixed>>
     */
    public function notes(User $viewer, ?string $workspaceId = null): array
    {
        return array_values($this->visible($viewer)
            ->when($workspaceId !== null, fn (Builder $query) => $query->where('notes.workspace_id', $workspaceId))
            // Folders above notes among siblings, then the manual order.
            ->orderByRaw("CASE WHEN notes.kind = 'folder' THEN 0 ELSE 1 END")
            ->orderBy('notes.position')
            ->orderBy('notes.id')
            ->get(['notes.id', 'notes.workspace_id', 'notes.parent_id', 'notes.kind', 'notes.preset', 'notes.title', 'notes.access', 'notes.created_by', 'notes.updated_by', 'notes.position', 'notes.created_at', 'notes.updated_at'])
            ->map(fn (Note $note): array => self::row($note))
            ->all());
    }

    /**
     * Latest "Notulensi cepat" the viewer can open (dashboard button menu),
     * newest edit first. Tabs (children) are not listed on their own.
     *
     * @return list<array{id: string, title: string, workspace_name: string|null, updated_at: string|null}>
     */
    public function recentMinutes(User $viewer, int $limit = 3): array
    {
        return array_values($this->visible($viewer)
            ->where('notes.preset', NotePreset::Minutes->value)
            ->with('workspace:id,name,type')
            ->orderByDesc('notes.updated_at')
            ->orderByDesc('notes.id')
            ->limit($limit)
            ->get(['notes.id', 'notes.workspace_id', 'notes.title', 'notes.updated_at'])
            ->map(fn (Note $note): array => [
                'id' => $note->id,
                'title' => $note->title,
                'workspace_name' => $note->workspace === null ? null : ($note->workspace->isPersonal() ? 'Pribadi' : $note->workspace->name),
                'updated_at' => self::iso($note->updated_at),
            ])
            ->all());
    }

    /**
     * Ids of visible notes whose title or text matches (full text, 'simple').
     *
     * @return list<string>
     */
    public function search(User $viewer, string $query): array
    {
        /** @var list<string> */
        return $this->visible($viewer)
            ->matching($query)
            ->limit(self::SEARCH_LIMIT)
            ->pluck('notes.id')
            ->all();
    }

    /**
     * Workspaces shown on /catatan: those with visible notes and those where
     * the viewer may write a new note (`can_create`), personal first.
     *
     * @param  list<array<string, mixed>>  $notes
     * @return list<array{id: string, key: string, name: string, color: string, type: string, can_create: bool}>
     */
    public function workspaces(User $viewer, array $notes): array
    {
        $withNotes = array_values(array_unique(array_map(fn (array $note): string => (string) $note['workspace_id'], $notes)));

        /** @var array<string, string> $roles */
        $roles = WorkspaceMember::query()->toBase()
            ->where('user_id', $viewer->id)
            ->pluck('role', 'workspace_id')
            ->map(fn (mixed $role): string => (string) $role)
            ->all();

        return array_values(Workspace::query()
            ->visibleTo($viewer)
            ->where(function (Builder $listed) use ($withNotes, $roles, $viewer): void {
                $listed->whereIn('workspaces.id', $withNotes)
                    ->orWhere(function (Builder $writable) use ($roles, $viewer): void {
                        $writable->whereNull('workspaces.archived_at')
                            ->where(function (Builder $mine) use ($roles, $viewer): void {
                                $mine->whereIn('workspaces.id', array_keys($roles))
                                    ->orWhere(fn (Builder $personal) => $personal
                                        ->where('workspaces.type', WorkspaceType::Personal->value)
                                        ->where('workspaces.owner_id', $viewer->id));
                            });
                    });
            })
            ->orderByRaw("CASE WHEN workspaces.type = 'personal' THEN 0 ELSE 1 END")
            ->orderBy('workspaces.name')
            ->get(['workspaces.id', 'workspaces.key', 'workspaces.name', 'workspaces.color', 'workspaces.type', 'workspaces.owner_id', 'workspaces.archived_at'])
            ->map(function (Workspace $workspace) use ($roles, $viewer): array {
                $role = WorkspaceRole::tryFrom($roles[$workspace->id] ?? '');
                $canCreate = $workspace->archived_at === null && ($workspace->isPersonal()
                    ? $workspace->owner_id === $viewer->id
                    : $role?->canEditTasks() === true);

                return [
                    'id' => $workspace->id,
                    'key' => $workspace->key,
                    'name' => $workspace->isPersonal() ? 'Pribadi' : $workspace->name,
                    'color' => $workspace->color ?? 'teal',
                    'type' => $workspace->type->value,
                    'can_create' => $canCreate,
                ];
            })
            ->filter(fn (array $workspace): bool => in_array($workspace['id'], $withNotes, true) || $workspace['can_create'])
            ->all());
    }

    /**
     * The open note with its content and the viewer's rights.
     *
     * @return array<string, mixed>
     */
    public function detail(Note $note, User $viewer): array
    {
        $note->loadMissing(['workspace', 'shares']);

        return [
            ...self::row($note),
            'workspace_key' => $note->workspace?->key,
            'workspace_type' => $note->workspace?->type->value,
            'content' => $note->content,
            'can_edit' => $this->policy->canEdit($viewer, $note),
            'can_share' => $this->policy->canShare($viewer, $note),
            'can_delete' => $this->policy->canDelete($viewer, $note),
        ];
    }

    /**
     * @return array{note_id: string, access: string, people: list<array{user_id: string, role: string}>}
     */
    public function share(Note $note): array
    {
        $note->loadMissing('shares');

        return [
            'note_id' => $note->id,
            'access' => $note->access->value,
            'people' => array_values($note->shares
                ->sortBy('created_at')
                ->map(fn (NoteShare $share): array => ['user_id' => $share->user_id, 'role' => $share->role->value])
                ->all()),
        ];
    }

    /**
     * Newest first, with the snapshot for the preview.
     *
     * @return list<array<string, mixed>>
     */
    public function versions(Note $note): array
    {
        return array_values(NoteVersion::query()
            ->where('note_id', $note->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::VERSION_LIMIT)
            ->get(['id', 'note_id', 'title', 'content', 'label', 'created_by', 'created_at'])
            ->map(fn (NoteVersion $version): array => [
                'id' => $version->id,
                'note_id' => $version->note_id,
                'created_by' => $version->created_by,
                'created_at' => self::iso($version->created_at),
                'title' => $version->title,
                'content' => $version->content,
                'label' => $version->label,
            ])
            ->all());
    }

    /**
     * @return Builder<Note>
     */
    private function visible(User $viewer): Builder
    {
        return Note::query()->visibleTo($viewer);
    }

    /**
     * @return array<string, mixed>
     */
    private static function row(Note $note): array
    {
        return [
            'id' => $note->id,
            'workspace_id' => $note->workspace_id,
            'parent_id' => $note->parent_id,
            'kind' => $note->kind->value,
            'preset' => $note->preset?->value,
            'title' => $note->title,
            'access' => $note->access->value,
            'created_by' => $note->created_by,
            'updated_by' => $note->updated_by,
            'position' => $note->position,
            'created_at' => self::iso($note->created_at),
            'updated_at' => self::iso($note->updated_at),
        ];
    }

    private static function iso(?CarbonInterface $value): ?string
    {
        return $value?->toIso8601String();
    }
}
