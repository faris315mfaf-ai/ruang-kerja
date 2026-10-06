<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\Channel;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * Drive files that may be attached in a channel: files of workspaces every
 * reader of the channel can open (decision 6 Oct 2026), so a message never
 * shows a file to someone without access.
 *   - workspace channel: files of that workspace;
 *   - public channel (every employee reads it): internal workspaces only;
 *   - private / DM / group: workspaces visible to every member.
 */
final class AttachableDriveFiles
{
    /**
     * @return Builder<DriveFile>
     */
    public function query(Channel $channel, User $viewer, ?string $search = null): Builder
    {
        $query = DriveFile::query()
            ->whereIn('drive_files.workspace_id', $this->workspaceIds($channel, $viewer))
            ->where('drive_files.kind', '!=', DriveFileKind::Folder->value)
            ->orderByDesc('drive_files.modified_at')
            ->orderBy('drive_files.id');

        $search = trim((string) $search);

        if ($search !== '') {
            $query->where('drive_files.name', 'ilike', '%'.addcslashes($search, '%_\\').'%');
        }

        return $query;
    }

    /**
     * @return list<string>
     */
    public function workspaceIds(Channel $channel, User $viewer): array
    {
        $visibleToViewer = Workspace::query()->visibleTo($viewer)->pluck('workspaces.id')->all();

        $ids = match ($channel->type) {
            ChannelType::Workspace => $channel->workspace_id !== null ? [$channel->workspace_id] : [],
            ChannelType::Public => Workspace::query()
                ->where('company_id', $channel->company_id)
                ->where('type', '!=', WorkspaceType::Personal->value)
                ->where('visibility', WorkspaceVisibility::Internal->value)
                ->pluck('id')->all(),
            ChannelType::Private, ChannelType::Dm, ChannelType::Group => $this->sharedByMembers($channel),
        };

        /** @var list<string> */
        return array_values(array_intersect($ids, $visibleToViewer));
    }

    /**
     * @return list<string>
     */
    private function sharedByMembers(Channel $channel): array
    {
        $members = User::query()
            ->whereIn('id', $channel->memberships()->select('user_id'))
            ->get();

        $shared = null;

        foreach ($members as $member) {
            /** @var list<string> $ids */
            $ids = Workspace::query()->visibleTo($member)->pluck('workspaces.id')->all();
            $shared = $shared === null ? $ids : array_values(array_intersect($shared, $ids));

            if ($shared === []) {
                break;
            }
        }

        return $shared ?? [];
    }
}
