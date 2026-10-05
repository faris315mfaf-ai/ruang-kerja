<?php

namespace App\Http\Resources;

use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Workspace header data (resources/js/features/workspaces/types.ts).
 * Expects `members_count` and `member_divisions_count` from withCount when shown.
 *
 * @mixin Workspace
 */
class WorkspaceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Workspace $workspace */
        $workspace = $this->resource;

        return [
            ...self::reference($workspace),
            'type_label' => $workspace->type->label(),
            'visibility' => $workspace->visibility->value,
            'description' => $workspace->description,
            'owner_id' => $workspace->owner_id,
            'archived' => $workspace->isArchived(),
            'members_count' => (int) ($workspace->getAttributes()['members_count'] ?? 0),
            'divisions_count' => (int) ($workspace->getAttributes()['member_divisions_count'] ?? 0),
        ];
    }

    /**
     * @return array{id: string, key: string, name: string, type: string, color: string}
     */
    public static function reference(Workspace $workspace): array
    {
        return [
            'id' => $workspace->id,
            'key' => $workspace->key,
            'name' => $workspace->name,
            'type' => $workspace->type->value,
            'color' => $workspace->color ?? 'gray',
        ];
    }
}
