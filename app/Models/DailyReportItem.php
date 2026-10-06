<?php

namespace App\Models;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use Carbon\CarbonImmutable;
use Database\Factories\DailyReportItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One task (or free work item) in a daily report. `task_key`/`task_title`
 * keep the report readable after the task is renamed or deleted.
 *
 * @property string $id
 * @property string $daily_report_id
 * @property string|null $task_id
 * @property string|null $task_key
 * @property string|null $task_title
 * @property string $progress_note
 * @property TaskStatusCategory|null $status_category_after
 * @property string|null $move_status_id "pindahkan ke" column, applied when the report is sent
 * @property int|null $percent
 * @property string|null $hours
 * @property int $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read DailyReport $report
 * @property-read Task|null $task
 */
#[Fillable(['daily_report_id', 'task_id', 'task_key', 'task_title', 'progress_note', 'status_category_after', 'move_status_id', 'percent', 'hours', 'position'])]
class DailyReportItem extends Model
{
    /** @use HasFactory<DailyReportItemFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status_category_after' => TaskStatusCategory::class,
            'percent' => 'integer',
            'hours' => 'decimal:2',
            'position' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<DailyReport, $this>
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(DailyReport::class, 'daily_report_id');
    }

    /**
     * @return BelongsTo<TaskStatus, $this>
     */
    public function moveStatus(): BelongsTo
    {
        return $this->belongsTo(TaskStatus::class, 'move_status_id');
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
