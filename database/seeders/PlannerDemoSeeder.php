<?php

namespace Database\Seeders;

use App\Domain\Analytics\Data\Period;
use App\Domain\Planner\Actions\PlanTask;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Planner\Queries\PersonalPlanner;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo "Ruang saya" (local/testing only, idempotent): the member and the
 * Kepala Divisi have already accepted a few assignments (the most urgent
 * into Hari ini, the next into Minggu ini) and their first personal note
 * sits in Hari ini since yesterday ("terbawa"); the rest stays under
 * "tugas baru". Skipped for a user who
 * already has plans. Only task_plans rows are written — no tasks change.
 */
class PlannerDemoSeeder extends Seeder
{
    /** @var array<string, list<PlanBucket>> accepted assignments, most urgent first */
    private const array ACCEPT = [
        'anggota@demo.test' => [PlanBucket::Today, PlanBucket::Today, PlanBucket::Week],
        'kadiv@demo.test' => [PlanBucket::Today, PlanBucket::Today, PlanBucket::Week],
    ];

    public function run(PersonalPlanner $planner, PlanTask $planTask): void
    {
        foreach (self::ACCEPT as $email => $buckets) {
            $user = User::query()->where('email', $email)->first();

            if ($user === null || TaskPlan::query()->ownedBy($user)->exists()) {
                continue;
            }

            $snapshot = $planner->for($user, CarbonImmutable::now());
            $incoming = collect($snapshot['incoming'])
                ->sortBy(fn (array $task): string => is_string($task['due_date']) ? $task['due_date'] : '9999-12-31')
                ->values();

            foreach ($buckets as $index => $bucket) {
                $task = isset($incoming[$index]) ? Task::query()->whereKey($incoming[$index]['id'])->first() : null;

                if ($task !== null) {
                    $planTask->handle($user, $task, $bucket);
                }
            }

            $note = collect($snapshot['lanes'])->flatten(1)->first(fn (array $task): bool => $task['is_personal'] === true && $task['done'] === false);
            $task = is_array($note) ? Task::query()->whereKey($note['id'])->first() : null;

            if ($task !== null) {
                // Planned yesterday: shows "terbawa dari kemarin".
                $planTask->handle($user, $task, PlanBucket::Today)
                    ->forceFill(['planned_for' => Period::officeDate(CarbonImmutable::now())->subDay()])
                    ->save();
            }
        }
    }
}
