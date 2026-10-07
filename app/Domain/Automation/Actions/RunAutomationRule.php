<?php

namespace App\Domain\Automation\Actions;

use App\Domain\Automation\Enums\NotifyRole;
use App\Domain\Automation\Enums\RunResult;
use App\Domain\Automation\Notifications\AutomationNotification;
use App\Domain\Automation\Services\AutomationAccess;
use App\Domain\Automation\Services\AutomationContext;
use App\Domain\Automation\Services\RuleMatcher;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\TaskAudience;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Division;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Throwable;

/**
 * Runs one automation rule on one task and writes the run log.
 *
 * Loop guards (with the "pindah ke kolom = kolom pemicu" form rule):
 * - a rule never runs twice in one chain (it cannot trigger itself, directly
 *   or through another rule);
 * - a chain stops after AutomationContext::MAX_DEPTH rules.
 *
 * The actions run as the rule's creator (or the workspace owner when the
 * creator lost access) through the regular task actions — UpdateTask for
 * assignees and labels, MoveTask for columns — so activities, realtime
 * events and notifications behave as if a person did it. Each action is
 * isolated: one failing action is logged without stopping the others.
 * Result: failed when an action failed, skipped when nothing changed,
 * success otherwise. A condition ("Dan …") that does not hold is not logged.
 */
final class RunAutomationRule
{
    public function __construct(
        private readonly RuleMatcher $matcher,
        private readonly AutomationContext $context,
        private readonly AutomationAccess $access,
        private readonly UpdateTask $updateTask,
        private readonly MoveTask $moveTask,
        private readonly TaskAudience $audience,
    ) {}

    /**
     * @param  list<string>  $chain  rules that already ran in this chain
     * @param  string|null  $cycle  de-duplication key of repeating triggers (overdue)
     */
    public function handle(AutomationRule $rule, Task $task, int $depth = 0, array $chain = [], ?string $cycle = null): ?AutomationRun
    {
        $task->loadMissing('workspace');

        if ($cycle !== null && AutomationRun::query()->where('rule_id', $rule->id)->where('task_id', $task->id)->where('cycle', $cycle)->exists()) {
            return null;
        }

        if (in_array($rule->id, $chain, true)) {
            return $this->record($rule, $task, RunResult::Skipped, 'Aturan ini sudah berjalan dalam rantai yang sama; dihentikan agar tidak berputar.', $depth, $cycle);
        }

        if ($depth >= AutomationContext::MAX_DEPTH) {
            return $this->record($rule, $task, RunResult::Skipped, 'Rantai otomasi sudah '.AutomationContext::MAX_DEPTH.' aturan; dihentikan.', $depth, $cycle);
        }

        if (! $this->matcher->conditionHolds($rule, $task)) {
            return null;
        }

        $actor = $this->actor($rule, $task->workspace);

        if ($actor === null) {
            return $this->record($rule, $task, RunResult::Failed, 'Pembuat aturan dan pemilik workspace tidak lagi bisa mengubah tugas.', $depth, $cycle);
        }

        $reason = $this->matcher->reason($rule);
        $parts = [];
        $failed = false;
        $changed = false;

        $this->context->within($rule->id, $depth, $chain, function () use ($rule, $task, $actor, $reason, &$parts, &$failed, &$changed): void {
            foreach ($rule->actions as $action) {
                try {
                    $fresh = Task::query()->with('workspace')->find($task->id);

                    if ($fresh === null) {
                        $parts[] = 'tugas sudah dihapus';

                        break;
                    }

                    [$did, $text] = $this->runAction($action, $rule, $fresh, $actor, $reason);
                    $changed = $changed || $did;
                    $parts[] = $text;
                } catch (Throwable $exception) {
                    report($exception);
                    $failed = true;
                    $parts[] = 'gagal: '.Str::limit($exception->getMessage(), 80);
                }
            }
        });

        $result = $failed ? RunResult::Failed : ($changed ? RunResult::Success : RunResult::Skipped);

        return $this->record($rule, $task, $result, Str::ucfirst(implode(' · ', $parts)), $depth, $cycle);
    }

    /**
     * @param  array<string, mixed>  $action
     * @return array{0: bool, 1: string} [changed something, log text]
     */
    private function runAction(array $action, AutomationRule $rule, Task $task, User $actor, string $reason): array
    {
        return match ($action['type'] ?? null) {
            'assign' => $this->assign($task, $actor, (string) ($action['user_id'] ?? '')),
            'add_label' => $this->addLabel($task, $actor, (string) ($action['label_id'] ?? '')),
            'move_status' => $this->move($task, $actor, (string) ($action['category'] ?? '')),
            'notify' => $this->notify($task, $rule, is_array($action['target'] ?? null) ? $action['target'] : [], $reason),
            default => [false, 'aksi tidak dikenal dilewati'],
        };
    }

    /**
     * @return array{0: bool, 1: string}
     */
    private function assign(Task $task, User $actor, string $userId): array
    {
        $member = WorkspaceMember::query()->where('workspace_id', $task->workspace_id)->where('user_id', $userId)->exists()
            || ($task->workspace->isPersonal() && $task->workspace->owner_id === $userId);
        $user = $member ? User::query()->active()->find($userId) : null;

        if ($user === null) {
            throw new \RuntimeException('penanggung jawab bukan anggota aktif workspace');
        }

        /** @var list<string> $current */
        $current = $task->assignees()->pluck('users.id')->all();

        if (in_array($userId, $current, true)) {
            return [false, "{$user->name} sudah penanggung jawab"];
        }

        $this->updateTask->handle($task, $actor, ['assignee_ids' => [...$current, $userId]]);

        return [true, "ditugaskan ke {$user->name}"];
    }

    /**
     * @return array{0: bool, 1: string}
     */
    private function addLabel(Task $task, User $actor, string $labelId): array
    {
        $label = Label::query()->where('workspace_id', $task->workspace_id)->find($labelId);

        if ($label === null) {
            throw new \RuntimeException('label sudah tidak ada di workspace');
        }

        /** @var list<string> $current */
        $current = $task->labels()->pluck('labels.id')->all();

        if (in_array($labelId, $current, true)) {
            return [false, "label \"{$label->name}\" sudah ada"];
        }

        $this->updateTask->handle($task, $actor, ['label_ids' => [...$current, $labelId]]);

        return [true, "label \"{$label->name}\" ditambahkan"];
    }

    /**
     * @return array{0: bool, 1: string}
     */
    private function move(Task $task, User $actor, string $category): array
    {
        $target = TaskStatusCategory::tryFrom($category) ?? throw new \RuntimeException('kategori kolom tidak dikenal');

        if ($task->status_category === $target) {
            return [false, "sudah di kolom {$target->label()}"];
        }

        $status = TaskStatus::query()
            ->where('workspace_id', $task->workspace_id)
            ->where('category', $target->value)
            ->orderBy('position')
            ->first();

        if ($status === null) {
            throw new \RuntimeException("tidak ada kolom berkategori {$target->label()}");
        }

        $this->moveTask->handle($task, $actor, $status);

        return [true, "dipindah ke kolom {$status->name}"];
    }

    /**
     * @param  array<string, mixed>  $target
     * @return array{0: bool, 1: string}
     */
    private function notify(Task $task, AutomationRule $rule, array $target, string $reason): array
    {
        $recipients = $this->audience->withAccess($task->workspace, $this->recipientIds($task, $target));

        if ($recipients->isEmpty()) {
            return [false, 'tidak ada penerima yang bisa melihat tugas'];
        }

        Notification::send($recipients->all(), new AutomationNotification($task, $rule->name, $reason));

        $names = $recipients->pluck('name')->all();

        return [true, count($names) <= 2 ? implode(' dan ', $names).' diberi tahu' : count($names).' orang diberi tahu'];
    }

    /**
     * @param  array<string, mixed>  $target
     * @return list<string>
     */
    private function recipientIds(Task $task, array $target): array
    {
        $workspace = $task->workspace;

        /** @var list<string> */
        return match ($target['kind'] ?? null) {
            'user' => is_string($target['id'] ?? null) ? [$target['id']] : [],
            'assignees' => $task->assignees()->pluck('users.id')->all(),
            'watchers' => $task->watchers()->pluck('users.id')->all(),
            'role' => match (NotifyRole::tryFrom((string) ($target['role'] ?? ''))) {
                NotifyRole::Anggota => $this->memberIds($workspace),
                NotifyRole::KepalaDivisi => $this->divisionHeadIds($task),
                NotifyRole::Hr => $this->roleHolderIds($workspace, Role::Hr),
                NotifyRole::Direksi => $this->roleHolderIds($workspace, Role::Direksi),
                null => [],
            },
            default => [],
        };
    }

    /**
     * @return list<string>
     */
    private function memberIds(Workspace $workspace): array
    {
        if ($workspace->isPersonal()) {
            return [$workspace->owner_id];
        }

        /** @var list<string> */
        return WorkspaceMember::query()->where('workspace_id', $workspace->id)->pluck('user_id')->all();
    }

    /**
     * Head of the workspace's division and of the assignees' divisions.
     *
     * @return list<string>
     */
    private function divisionHeadIds(Task $task): array
    {
        $divisionIds = User::query()
            ->whereIn('id', $task->assignees()->select('users.id'))
            ->whereNotNull('division_id')
            ->pluck('division_id')
            ->push($task->workspace->division_id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($divisionIds === []) {
            return [];
        }

        /** @var list<string> */
        return Division::query()->whereIn('id', $divisionIds)->whereNotNull('head_user_id')->pluck('head_user_id')->unique()->values()->all();
    }

    /**
     * @return list<string>
     */
    private function roleHolderIds(Workspace $workspace, Role $role): array
    {
        /** @var list<string> */
        return User::query()
            ->where('company_id', $workspace->company_id)
            ->active()
            ->role($role->value)
            ->pluck('id')
            ->all();
    }

    /**
     * The rule's creator while they may still edit tasks there, else the
     * workspace owner; null when neither can.
     */
    private function actor(AutomationRule $rule, Workspace $workspace): ?User
    {
        $candidates = User::query()
            ->whereIn('id', array_values(array_filter([$rule->created_by, $workspace->owner_id])))
            ->get()
            ->keyBy('id');

        foreach ([$rule->created_by, $workspace->owner_id] as $id) {
            $user = $id !== null ? $candidates->get($id) : null;

            if ($user instanceof User && $this->access->canEditTasks($user, $workspace)) {
                return $user;
            }
        }

        return null;
    }

    private function record(AutomationRule $rule, Task $task, RunResult $result, string $detail, int $depth, ?string $cycle): ?AutomationRun
    {
        $task->loadMissing('workspace');
        $now = now();

        try {
            return DB::transaction(function () use ($rule, $task, $result, $detail, $depth, $cycle, $now): AutomationRun {
                $run = AutomationRun::query()->create([
                    'rule_id' => $rule->id,
                    'task_id' => $task->id,
                    'task_key' => Str::limit($task->displayKey(), 20, ''),
                    'task_title' => Str::limit($task->title, 255, ''),
                    'result' => $result,
                    'detail' => Str::limit($detail === '' ? $result->label() : $detail, 255),
                    'depth' => $depth,
                    'cycle' => $cycle,
                    'ran_at' => $now,
                ]);

                AutomationRule::query()->whereKey($rule->id)->update([
                    'run_count' => DB::raw('run_count + 1'),
                    'last_run_at' => $now,
                ]);

                return $run;
            });
        } catch (UniqueConstraintViolationException) {
            // The same overdue cycle was logged by a concurrent run.
            return null;
        }
    }
}
