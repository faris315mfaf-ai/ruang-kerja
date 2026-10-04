<?php

/*
 * Test helper (TaskNumberingConcurrencyTest): boots the app in a separate OS
 * process and creates N tasks through CreateTask, so several processes race
 * for the same workspace sequence. Usage: php create-tasks.php <workspace-id> <user-id> <count>
 */

use App\Domain\Tasks\Actions\CreateTask;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $workspaceId, $userId, $count] = $argv;

$workspace = Workspace::query()->findOrFail($workspaceId);
$user = User::query()->findOrFail($userId);

for ($i = 1; $i <= (int) $count; $i++) {
    app(CreateTask::class)->handle($workspace, $user, ['title' => "Tugas paralel {$i} dari proses ".getmypid()]);
}

echo "ok\n";
