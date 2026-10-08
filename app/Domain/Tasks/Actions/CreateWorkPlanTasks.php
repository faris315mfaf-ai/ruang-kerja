<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Tasks\Enums\TaskSource;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\Task;

/**
 * "Rencana kerja jadi tugas otomatis" (keputusan pemilik 9 Okt 2026): every
 * work-plan point of a check-in becomes a task in the employee's own
 * personal workspace for that work date — title = the point, assignee =
 * the employee, due = work_date, source = attendance + source_id = the day.
 *
 * Called from CheckIn inside its transaction, so a check-in and its tasks
 * commit (or roll back) together. Idempotent: a replay only creates tasks
 * for points that do not have one yet (multiset of titles), so a retried
 * check-in or a re-dispatch never duplicates tasks.
 */
final class CreateWorkPlanTasks
{
    /** tasks.title is varchar(255); a longer point keeps its full text as the description. */
    private const int TITLE_LIMIT = 255;

    public function __construct(
        private readonly EnsurePersonalWorkspace $personal,
        private readonly CreateTask $createTask,
    ) {}

    /**
     * @return list<Task> the tasks created by this call (empty when the plan is
     *                    blank or every point already has its task)
     */
    public function handle(AttendanceDay $day): array
    {
        $points = $this->normalize($day->work_plan ?? []);

        if ($points === []) {
            return [];
        }

        $user = $day->user;
        $workspace = $this->personal->handle($user);

        // Multiset of titles already generated for this day: a point only
        // becomes a task when its occurrence has none yet (identical texts in
        // one plan each keep their own task).
        $existing = Task::query()
            ->fromAttendance()
            ->where('source_id', $day->id)
            ->pluck('title')
            ->countBy()
            ->all();

        $created = [];

        foreach ($points as $point) {
            if (($existing[$point] ?? 0) > 0) {
                $existing[$point]--;

                continue;
            }

            $created[] = $this->createTask->handle($workspace, $user, [
                'title' => mb_substr($point, 0, self::TITLE_LIMIT),
                'description_text' => $point,
                'due_date' => $day->work_date->toDateString(),
                'assignee_ids' => [$user->id],
                'source' => TaskSource::Attendance,
                'source_id' => $day->id,
            ]);
        }

        return $created;
    }

    /**
     * The stored plan is already a clean list; trim and drop blanks again so
     * the action is safe when called directly with raw input.
     *
     * @param  list<mixed>  $points
     * @return list<string>
     */
    private function normalize(array $points): array
    {
        $clean = [];

        foreach ($points as $point) {
            if (is_string($point) && trim($point) !== '') {
                $clean[] = trim($point);
            }
        }

        return $clean;
    }
}
