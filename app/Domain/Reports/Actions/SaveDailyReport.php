<?php

namespace App\Domain\Reports\Actions;

use App\Domain\Reports\Data\DailyReportInput;
use App\Domain\Reports\Data\DailyReportItemInput;
use App\Domain\Reports\Support\ReportDay;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Laporan progres harian: stores today's report of $user (draft autosave and
 * the content part of "Kirim"). Only the report of the current office date
 * can be written; afterwards it is locked. Items are replaced as a whole and
 * keep a copy of the task key & title; tasks must be visible to the writer and
 * a "pindahkan ke" column must belong to the task's workspace and be allowed by
 * the task policy (the move itself happens in SubmitDailyReport).
 */
final class SaveDailyReport
{
    public const int MAX_ITEMS = 30;

    public function handle(User $user, DailyReportInput $input, ?CarbonImmutable $now = null): DailyReport
    {
        $today = ReportDay::today($now);

        if ($input->reportDate !== $today) {
            throw ValidationException::withMessages(['report_date' => 'Laporan tanggal itu sudah terkunci (batas pukul 23.59). Muat ulang untuk menulis laporan hari ini.']);
        }

        if (count($input->items) > self::MAX_ITEMS) {
            throw ValidationException::withMessages(['items' => 'Maksimal '.self::MAX_ITEMS.' baris pekerjaan.']);
        }

        $tasks = $this->tasks($user, $input->items);
        $statuses = $this->moveTargets($user, $input->items, $tasks);

        return DB::transaction(function () use ($user, $input, $today, $tasks, $statuses): DailyReport {
            $report = DailyReport::query()
                ->where('user_id', $user->id)
                ->whereDate('report_date', $today)
                ->lockForUpdate()
                ->first() ?? new DailyReport(['company_id' => $user->company_id, 'user_id' => $user->id, 'report_date' => $today]);

            $report->fill(['summary' => $input->summary, 'blockers' => $input->blockers, 'notes' => $input->notes])->save();

            // Category reached by an earlier "Kirim" stays with the same task + target column.
            /** @var array<string, string|null> $reached */
            $reached = [];

            foreach ($report->items()->get() as $previous) {
                if ($previous->task_id !== null && $previous->move_status_id !== null) {
                    $reached[$previous->task_id.'|'.$previous->move_status_id] = $previous->status_category_after?->value;
                }
            }

            $report->items()->delete();

            foreach ($input->items as $position => $item) {
                $task = $item->taskId === null ? null : $tasks->get($item->taskId);
                $move = $item->moveStatusId === null ? null : $statuses->get($item->moveStatusId);

                DailyReportItem::query()->create([
                    'daily_report_id' => $report->id,
                    'task_id' => $task?->id,
                    'task_key' => $task?->displayKey(),
                    'task_title' => $task === null ? null : mb_substr($task->title, 0, 255),
                    'progress_note' => $item->progressNote,
                    'percent' => $item->percent,
                    'hours' => $item->hours,
                    'move_status_id' => $move?->id,
                    'status_category_after' => $task !== null && $move !== null ? ($reached[$task->id.'|'.$move->id] ?? null) : null,
                    'position' => $position,
                ]);
            }

            return $report->load('items');
        });
    }

    /**
     * Tasks of the items, visible to $user, keyed by id (with workspace + status).
     *
     * @param  list<DailyReportItemInput>  $items
     * @return Collection<string, Task>
     */
    private function tasks(User $user, array $items): Collection
    {
        $ids = array_values(array_filter(array_map(fn (DailyReportItemInput $item): ?string => $item->taskId, $items)));

        if (count($ids) !== count(array_unique($ids))) {
            throw ValidationException::withMessages(['items' => 'Satu tugas cukup dilaporkan sekali.']);
        }

        if ($ids === []) {
            return new Collection;
        }

        $tasks = Task::query()
            ->visibleTo($user)
            ->with(['workspace', 'workspace.membership' => fn ($membership) => $membership->where('user_id', $user->id)])
            ->whereKey($ids)
            ->get()
            ->keyBy('id');

        foreach ($items as $index => $item) {
            if ($item->taskId !== null && ! $tasks->has($item->taskId)) {
                throw ValidationException::withMessages(["items.{$index}.task_id" => 'Tugas tidak ditemukan atau tidak bisa Anda lihat.']);
            }
        }

        return $tasks;
    }

    /**
     * "Pindahkan ke" columns, keyed by id: a column of the task's workspace that
     * the writer may move the task to (TaskPolicy::move).
     *
     * @param  list<DailyReportItemInput>  $items
     * @param  Collection<string, Task>  $tasks
     * @return Collection<string, TaskStatus>
     */
    private function moveTargets(User $user, array $items, Collection $tasks): Collection
    {
        $ids = array_values(array_filter(array_map(fn (DailyReportItemInput $item): ?string => $item->taskId === null ? null : $item->moveStatusId, $items)));
        $statuses = $ids === [] ? new Collection : TaskStatus::query()->whereKey($ids)->get()->keyBy('id');

        foreach ($items as $index => $item) {
            if ($item->moveStatusId === null) {
                continue;
            }

            $task = $item->taskId === null ? null : $tasks->get($item->taskId);
            $status = $statuses->get($item->moveStatusId);

            if ($task === null || $status === null || $status->workspace_id !== $task->workspace_id) {
                throw ValidationException::withMessages(["items.{$index}.move_status_id" => 'Kolom tujuan tidak ada di workspace tugas ini.']);
            }

            if (Gate::forUser($user)->denies('move', $task)) {
                throw ValidationException::withMessages(["items.{$index}.move_status_id" => "Anda tidak bisa memindahkan {$task->displayKey()}."]);
            }
        }

        return $statuses;
    }
}
