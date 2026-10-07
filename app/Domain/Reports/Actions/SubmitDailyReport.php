<?php

namespace App\Domain\Reports\Actions;

use App\Domain\Reports\Data\DailyReportInput;
use App\Domain\Tasks\Actions\MoveTask;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * "Kirim" of the daily report: saves the content (SaveDailyReport), moves
 * the tasks whose "pindahkan ke" column differs from their current one
 * (MoveTask, subject to the task policy) and records the reached category
 * in status_category_after. The first send sets submitted_at; the report
 * can be changed and sent again until 23.59 of that day.
 */
final class SubmitDailyReport
{
    public function __construct(
        private readonly SaveDailyReport $save,
        private readonly MoveTask $move,
    ) {}

    public function handle(User $user, DailyReportInput $input, ?CarbonImmutable $now = null): DailyReport
    {
        if ($input->items === []) {
            throw ValidationException::withMessages(['items' => 'Tambahkan minimal satu pekerjaan yang Anda kerjakan hari ini.']);
        }

        foreach ($input->items as $index => $item) {
            if ($item->progressNote === '') {
                throw ValidationException::withMessages(["items.{$index}.progress_note" => 'Tulis catatan progres untuk pekerjaan ini.']);
            }
        }

        return DB::transaction(function () use ($user, $input, $now): DailyReport {
            $report = $this->save->handle($user, $input, $now);

            foreach ($report->items as $item) {
                $this->applyMove($user, $item);
            }

            if ($report->submitted_at === null) {
                $report->forceFill(['submitted_at' => $now ?? now()])->save();
            }

            return $report->load('items');
        });
    }

    private function applyMove(User $user, DailyReportItem $item): void
    {
        if ($item->task_id === null || $item->move_status_id === null) {
            return;
        }

        $task = Task::query()->with('workspace')->find($item->task_id);
        $status = TaskStatus::query()->find($item->move_status_id);

        if ($task === null || $status === null) {
            return;
        }

        if (Gate::forUser($user)->denies('move', $task)) {
            throw ValidationException::withMessages(['items' => "Anda tidak bisa memindahkan {$task->displayKey()}."]);
        }

        if ($task->status_id !== $status->id) {
            $this->move->handle($task, $user, $status);
        }

        $item->forceFill(['status_category_after' => $status->category])->save();
    }
}
