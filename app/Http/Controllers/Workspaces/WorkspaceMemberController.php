<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Workspaces\Actions\AddWorkspaceMember;
use App\Domain\Workspaces\Actions\RemoveWorkspaceMember;
use App\Domain\Workspaces\Actions\UpdateWorkspaceMemberRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspaces\WorkspaceMemberRequest;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Pengaturan › Anggota: invite, change role, remove.
 */
class WorkspaceMemberController extends Controller
{
    public function store(WorkspaceMemberRequest $request, Workspace $workspace, #[CurrentUser] User $user, AddWorkspaceMember $add): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $member = User::query()->findOrFail($request->string('user_id')->toString());
        $add->handle($workspace, $user, $member, $request->role());

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$member->name} ditambahkan sebagai {$request->role()->label()}."]);

        return to_route('workspaces.settings', $workspace);
    }

    public function update(WorkspaceMemberRequest $request, Workspace $workspace, User $member, #[CurrentUser] User $user, UpdateWorkspaceMemberRole $update): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $update->handle($workspace, $user, $member, $request->role());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Peran {$member->name} diubah menjadi {$request->role()->label()}."]);

        return to_route('workspaces.settings', $workspace);
    }

    public function destroy(Workspace $workspace, User $member, #[CurrentUser] User $user, RemoveWorkspaceMember $remove): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $remove->handle($workspace, $user, $member);

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$member->name} dikeluarkan dari workspace."]);

        return to_route('workspaces.settings', $workspace);
    }
}
