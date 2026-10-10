<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Workspaces\Enums\WorkspaceGroup;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Workspace picker of the mobile app (Tahap 1): every workspace the caller
 * may see (the same Workspace::visibleTo as the web directory), grouped like
 * the web — Pribadi · Divisi & tim · Proyek yang diikuti · Lainnya
 * (WorkspaceGroup, keputusan pemilik 6 Okt 2026). All four groups are always
 * present so the client can render a stable tab layout; `arsip` marks the
 * rows the web directory shows with a "Diarsipkan" pill.
 */
class WorkspaceController extends Controller
{
    public function __invoke(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', Workspace::class);

        $workspaces = Workspace::query()
            ->visibleTo($user)
            ->withMembershipOf($user)
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'type', 'archived_at', 'owner_id'])
            ->sortBy(fn (Workspace $workspace): string => $workspace->type->sortOrder().mb_strtolower($workspace->name));

        $groups = [];
        foreach (WorkspaceGroup::cases() as $group) {
            $groups[$group->value] = ['jenis' => $group->value, 'label' => $group->label(), 'items' => []];
        }

        foreach ($workspaces as $workspace) {
            $group = WorkspaceGroup::of(
                $workspace->type,
                $workspace->membership !== null || $workspace->type === WorkspaceType::Personal,
            );

            $groups[$group->value]['items'][] = [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'arsip' => $workspace->isArchived(),
            ];
        }

        return response()->json(['groups' => array_values($groups)]);
    }
}
