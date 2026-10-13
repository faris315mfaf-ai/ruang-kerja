<?php

namespace App\Domain\Notes\Queries;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Services\NoteViewerRights;
use App\Models\User;
use App\Models\Workspace;

/**
 * The folder/note/sub-page tree of one workspace for the mobile app, nested
 * from the flat NoteLibrary rows (already limited to what the viewer may
 * open, folders above notes, manual order). A row whose parent the viewer
 * cannot open (e.g. a note under a restricted note) is promoted to the root
 * so nothing visible disappears; its `parent_id` stays as stored.
 */
final class NoteTree
{
    /**
     * @param  list<array<string, mixed>>  $rows  NoteLibrary::notes() rows, optionally with `penulis`/`penyunting`
     * @return list<array<string, mixed>>
     */
    public function build(User $viewer, Workspace $workspace, array $rows): array
    {
        $rights = NoteViewerRights::forWorkspace($viewer, $workspace, array_map(fn (array $row): string => (string) $row['id'], $rows));

        $ids = array_flip(array_map(fn (array $row): string => (string) $row['id'], $rows));

        /** @var array<string, list<array<string, mixed>>> $children */
        $children = [];
        /** @var list<array<string, mixed>> $roots */
        $roots = [];

        foreach ($rows as $row) {
            $parentId = is_string($row['parent_id'] ?? null) ? $row['parent_id'] : null;

            if ($parentId !== null && isset($ids[$parentId]) && $parentId !== $row['id']) {
                $children[$parentId][] = $row;
            } else {
                $roots[] = $row;
            }
        }

        $node = function (array $row) use (&$node, $children, $rights): array {
            $access = NoteAccess::from((string) $row['access']);
            $createdBy = is_string($row['created_by'] ?? null) ? $row['created_by'] : null;
            $role = $rights->role((string) $row['id'], $access, $createdBy);

            return [
                'id' => $row['id'],
                'parent_id' => $row['parent_id'],
                'kind' => $row['kind'],
                'preset' => $row['preset'],
                'title' => $row['title'],
                'access' => $access->value,
                'invited_only' => $access === NoteAccess::Restricted,
                'position' => $row['position'],
                'penulis' => $row['penulis'] ?? null,
                'penyunting' => $row['penyunting'] ?? null,
                'updated_at' => $row['updated_at'],
                'my_role' => $role,
                'can_edit' => $role !== 'view',
                'children' => array_map($node, $children[(string) $row['id']] ?? []),
            ];
        };

        return array_map($node, $roots);
    }
}
