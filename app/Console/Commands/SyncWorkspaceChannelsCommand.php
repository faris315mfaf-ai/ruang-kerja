<?php

namespace App\Console\Commands;

use App\Domain\Chat\Actions\SyncWorkspaceChannel;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Workspace;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Creates/updates the automatic Obrolan channel of every non-personal
 * workspace (F2-1). New workspaces get theirs through the listener; run this
 * once after deploying the chat tables, and safely again any time.
 */
#[Signature('chat:sync-workspace-channels')]
#[Description('Buat/sinkronkan channel obrolan otomatis untuk setiap workspace non-pribadi')]
final class SyncWorkspaceChannelsCommand extends Command
{
    public function handle(SyncWorkspaceChannel $sync): int
    {
        $count = 0;

        Workspace::query()
            ->where('type', '!=', WorkspaceType::Personal->value)
            ->orderBy('id')
            ->each(function (Workspace $workspace) use ($sync, &$count): void {
                $sync->handle($workspace);
                $count++;
            });

        $this->info("{$count} channel workspace disinkronkan.");

        return self::SUCCESS;
    }
}
