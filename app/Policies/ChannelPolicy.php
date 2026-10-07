<?php

namespace App\Policies;

use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Obrolan channels (docs/DATABASE.md §7). Reading: workspace channel = the
 * workspace (WorkspacePolicy::canView), public = every employee of the
 * company, private / DM / group = members only (decision 6 Oct 2026: no
 * role, not even Super Admin, reads them). Invisible → 404. Archived channel
 * or workspace → read-only (403). No Gate::before.
 */
class ChannelPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    /**
     * Lists always go through Channel::visibleTo().
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /** Free channels (public/private), DMs and groups: any employee. */
    public function create(User $user): bool
    {
        return true;
    }

    public function view(User $user, Channel $channel): Response
    {
        return $this->canView($user, $channel) ? Response::allow() : Response::denyAsNotFound();
    }

    /**
     * Send messages, react, attach. Public channels: anyone who sees them
     * (PostMessage joins them); workspace channels: workspace members only
     * (Direksi reading a workspace they are not in stays read-only).
     */
    public function post(User $user, Channel $channel): Response
    {
        if (! $this->canView($user, $channel)) {
            return Response::denyAsNotFound();
        }

        if ($channel->isArchived()) {
            return Response::deny('Obrolan ini sudah diarsipkan dan hanya bisa dibaca.');
        }

        return $this->canPost($user, $channel)
            ? Response::allow()
            : Response::deny('Hanya anggota workspace yang dapat mengirim pesan di sini.');
    }

    /** Moderate: delete others' messages. */
    public function manage(User $user, Channel $channel): Response
    {
        if (! $this->canView($user, $channel)) {
            return Response::denyAsNotFound();
        }

        return $this->canManage($user, $channel)
            ? Response::allow()
            : Response::deny('Hanya pemilik atau admin obrolan yang dapat melakukan ini.');
    }

    /** Mute / mark as read: own membership only. */
    public function participate(User $user, Channel $channel): Response
    {
        return $this->view($user, $channel);
    }

    public function canView(User $user, Channel $channel): bool
    {
        if ($channel->company_id !== $user->company_id) {
            return false;
        }

        return match ($channel->type) {
            ChannelType::Workspace => $channel->workspace !== null && $this->workspaces->canView($user, $channel->workspace),
            ChannelType::Public => true,
            ChannelType::Private, ChannelType::Dm, ChannelType::Group => $channel->hasMember($user),
        };
    }

    public function canPost(User $user, Channel $channel): bool
    {
        if ($channel->isArchived() || ! $this->canView($user, $channel)) {
            return false;
        }

        return match ($channel->type) {
            ChannelType::Workspace => $channel->workspace?->roleOf($user) !== null,
            ChannelType::Public => true,
            ChannelType::Private, ChannelType::Dm, ChannelType::Group => $channel->hasMember($user),
        };
    }

    public function canManage(User $user, Channel $channel): bool
    {
        if (! $this->canView($user, $channel)) {
            return false;
        }

        if ($channel->membershipOf($user)?->role->canModerate() === true) {
            return true;
        }

        return $channel->type === ChannelType::Workspace
            && $channel->workspace !== null
            && ($channel->workspace->roleOf($user)?->atLeast(WorkspaceRole::Admin) === true
                || $this->workspaces->canManage($user, $channel->workspace));
    }
}
