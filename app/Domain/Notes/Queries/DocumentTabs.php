<?php

namespace App\Domain\Notes\Queries;

use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Notes\Services\NoteViewerRights;
use App\Models\Note;
use App\Models\User;
use App\Policies\NotePolicy;
use Carbon\CarbonInterface;

/**
 * Tabs of a document (Notulensi, resources/js/features/notes/lib.ts
 * documentTabs/documentRoot): the document itself first, its child notes as
 * tabs (level 0), their children as sub-tabs (level 1). The document is the
 * top-most note above the given one that the viewer can open (a folder ends
 * the climb). Deeper pages and folders are not tabs.
 */
final class DocumentTabs
{
    private const int MAX_DEPTH = 100;

    public function __construct(private readonly NotePolicy $policy) {}

    /**
     * @return array{root_id: string, active_id: string, can_create: bool, next_tab_title: string, tabs: list<array<string, mixed>>}
     */
    public function forNote(Note $note, User $viewer): array
    {
        $note->loadMissing('workspace');
        $workspace = $note->workspace;
        abort_if($workspace === null, 404);

        /** @var array<string, Note> $byId */
        $byId = Note::query()
            ->visibleTo($viewer)
            ->where('notes.workspace_id', $workspace->id)
            ->where('notes.kind', NoteKind::Note->value)
            ->orderBy('notes.position')
            ->orderBy('notes.id')
            ->get(['notes.id', 'notes.workspace_id', 'notes.parent_id', 'notes.kind', 'notes.preset', 'notes.title', 'notes.access', 'notes.created_by', 'notes.position', 'notes.updated_at'])
            ->keyBy('id')
            ->all();

        $root = $byId[$note->id] ?? $note;

        for ($depth = 0; $depth < self::MAX_DEPTH && $root->parent_id !== null && isset($byId[$root->parent_id]); $depth++) {
            $root = $byId[$root->parent_id];
        }

        $childrenOf = fn (string $id): array => array_values(array_filter($byId, fn (Note $candidate): bool => $candidate->parent_id === $id));

        $rights = NoteViewerRights::forWorkspace($viewer, $workspace, array_keys($byId));

        $row = function (Note $tab, int $level, string $tabId) use ($note, $rights): array {
            $role = $rights->role($tab->id, $tab->access, $tab->created_by);

            return [
                'id' => $tab->id,
                'parent_id' => $tab->parent_id,
                'title' => $tab->title,
                'preset' => $tab->preset?->value,
                'level' => $level,
                'tab_id' => $tabId,
                'position' => $tab->position,
                'active' => $tab->id === $note->id,
                'my_role' => $role,
                'can_edit' => $role !== 'view',
                'updated_at' => self::iso($tab->updated_at),
            ];
        };

        $tabs = [$row($root, 0, $root->id)];
        $topLevel = 1;
        $subCounts = [];

        foreach ($childrenOf($root->id) as $tab) {
            $tabs[] = $row($tab, 0, $tab->id);
            $topLevel++;

            foreach ($childrenOf($tab->id) as $sub) {
                $tabs[] = $row($sub, 1, $tab->id);
                $subCounts[$tab->id] = ($subCounts[$tab->id] ?? 0) + 1;
            }
        }

        // "Sub-tab n" titles for the tab menu: the app names a new tab like the web.
        $tabs = array_map(fn (array $tab): array => $tab['level'] === 0
            ? [...$tab, 'next_subtab_title' => 'Sub-tab '.(($subCounts[$tab['id']] ?? 0) + 1)]
            : $tab, $tabs);

        return [
            'root_id' => $root->id,
            'active_id' => $note->id,
            'can_create' => $this->policy->canCreateIn($viewer, $workspace),
            'next_tab_title' => 'Tab '.($topLevel + 1),
            'tabs' => $tabs,
        ];
    }

    private static function iso(?CarbonInterface $value): ?string
    {
        return $value?->toIso8601String();
    }
}
