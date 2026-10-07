<?php

namespace Database\Seeders;

use App\Domain\Automation\Enums\RuleTriggerType;
use App\Domain\Automation\Enums\RunResult;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Label;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\WorkspaceTemplate;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo Otomasi (local/testing, idempotent; F2-4): rules in Divisi
 * Operasional and Tim Gudang with a short run log, recurring tasks, task
 * templates and two workspace templates — adapted from the former preview
 * fixtures (features/automation/fixtures.ts). Rows are written directly: no
 * rule runs, tasks, notifications or events.
 */
class AutomationDemoSeeder extends Seeder
{
    public function run(): void
    {
        $kadiv = User::query()->where('email', 'kadiv@demo.test')->first();
        $ops = Workspace::query()->where('key', 'OPS')->first();

        if ($kadiv === null || $ops === null) {
            return;
        }

        $gdg = Workspace::query()->where('key', 'GDG')->first();
        $plq = Workspace::query()->where('key', 'PLQ')->first();
        $anggota = User::query()->where('email', 'anggota@demo.test')->first();
        $now = CarbonImmutable::now();

        $this->rules($ops, $gdg, $kadiv, $anggota, $now);
        $this->recurring($ops, $gdg, $kadiv, $anggota);
        $this->taskTemplates($ops, $kadiv);
        $this->workspaceTemplates($ops, $plq, $kadiv);
    }

    private function rules(Workspace $ops, ?Workspace $gdg, User $kadiv, ?User $anggota, CarbonImmutable $now): void
    {
        $report = Label::query()->where('workspace_id', $ops->id)->where('name', 'Laporan')->value('id');

        $review = $this->rule($ops, $kadiv, 'Review ke Kepala Divisi', ['type' => 'task_moved', 'category' => 'review'], null, [
            ['type' => 'notify', 'target' => ['kind' => 'role', 'role' => 'kepala_divisi']],
        ]);
        $overdue = $this->rule($ops, $kadiv, 'Lewat tenggat → kabari penanggung jawab', ['type' => 'task_overdue'], ['type' => 'priority', 'priority' => 1], [
            ['type' => 'notify', 'target' => ['kind' => 'assignees']],
            ['type' => 'notify', 'target' => ['kind' => 'user', 'id' => $kadiv->id]],
        ]);

        if (is_string($report)) {
            $this->rule($ops, $kadiv, 'Selesai → label Laporan', ['type' => 'task_moved', 'category' => 'done'], null, [
                ['type' => 'add_label', 'label_id' => $report],
            ], active: false);
        }

        if ($gdg !== null) {
            $stock = Label::query()->where('workspace_id', $gdg->id)->where('name', 'Stok')->value('id');
            $assignee = $anggota !== null && WorkspaceMember::query()->where('workspace_id', $gdg->id)->where('user_id', $anggota->id)->exists()
                ? $anggota
                : $kadiv;

            if (is_string($stock)) {
                $this->rule($gdg, $kadiv, 'Tugas stok → tugaskan petugas gudang', ['type' => 'task_created_with_label', 'label_id' => $stock], null, [
                    ['type' => 'assign', 'user_id' => $assignee->id],
                    ['type' => 'move_status', 'category' => 'todo'],
                ]);
            }
        }

        // A short log (only once): the rules "ran" on existing OPS tasks.
        if (AutomationRun::query()->whereIn('rule_id', [$review->id, $overdue->id])->exists()) {
            return;
        }

        $tasks = Task::query()->where('workspace_id', $ops->id)->orderBy('number')->limit(4)->get();

        foreach ($tasks as $index => $task) {
            $rule = $index % 2 === 0 ? $review : $overdue;
            $result = $index === 3 ? RunResult::Skipped : RunResult::Success;
            AutomationRun::query()->create([
                'rule_id' => $rule->id,
                'task_id' => $task->id,
                'task_key' => 'OPS-'.$task->number,
                'task_title' => $task->title,
                'result' => $result,
                'detail' => $result === RunResult::Skipped
                    ? 'Tidak ada penerima yang bisa melihat tugas'
                    : ($rule->is($review) ? "{$kadiv->name} diberi tahu" : '2 orang diberi tahu'),
                'depth' => 0,
                'ran_at' => $now->subHours(5 + $index * 20),
            ]);
        }

        foreach ([$review, $overdue] as $rule) {
            $rule->update([
                'run_count' => AutomationRun::query()->where('rule_id', $rule->id)->count(),
                'last_run_at' => AutomationRun::query()->where('rule_id', $rule->id)->max('ran_at'),
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $trigger
     * @param  array<string, mixed>|null  $condition
     * @param  list<array<string, mixed>>  $actions
     */
    private function rule(Workspace $workspace, User $creator, string $name, array $trigger, ?array $condition, array $actions, bool $active = true): AutomationRule
    {
        return AutomationRule::query()->firstOrCreate(
            ['workspace_id' => $workspace->id, 'name' => $name],
            [
                'company_id' => $workspace->company_id,
                'trigger_type' => RuleTriggerType::from($trigger['type']),
                'trigger' => $trigger,
                'condition' => $condition,
                'actions' => $actions,
                'is_active' => $active,
                'created_by' => $creator->id,
            ],
        );
    }

    private function recurring(Workspace $ops, ?Workspace $gdg, User $kadiv, ?User $anggota): void
    {
        $today = CarbonImmutable::now(config()->string('app.office_timezone'))->startOfMonth()->toDateString();
        $items = [
            [$ops, 'Laporan mingguan operasional', $kadiv, TaskPriority::High, ['kind' => 'weekly', 'weekdays' => [5]]],
            [$ops, 'Rapat koordinasi tim (agenda)', $kadiv, TaskPriority::Medium, ['kind' => 'every_n_weeks', 'interval' => 2, 'weekdays' => [2]]],
            [$ops, 'Rekap absensi bulanan divisi', $kadiv, TaskPriority::Medium, ['kind' => 'monthly', 'day_of_month' => 31]],
        ];

        if ($gdg !== null) {
            $assignee = $anggota !== null && WorkspaceMember::query()->where('workspace_id', $gdg->id)->where('user_id', $anggota->id)->exists() ? $anggota : $kadiv;
            $items[] = [$gdg, 'Cek suhu ruang dingin', $assignee, TaskPriority::High, ['kind' => 'daily', 'weekdays_only' => true]];
            $items[] = [$gdg, 'Opname rak B', $assignee, TaskPriority::Low, ['kind' => 'monthly', 'day_of_month' => 25]];
        }

        foreach ($items as [$workspace, $title, $assignee, $priority, $pattern]) {
            RecurringTask::query()->firstOrCreate(
                ['workspace_id' => $workspace->id, 'title' => $title],
                [
                    'company_id' => $workspace->company_id,
                    'assignee_id' => $assignee->id,
                    'priority' => $priority,
                    'pattern' => $pattern,
                    'starts_on' => $today,
                    'created_by' => $kadiv->id,
                ],
            );
        }
    }

    private function taskTemplates(Workspace $ops, User $kadiv): void
    {
        $templates = [
            [null, 'Kunjungan klien', 'Persiapan, kunjungan, dan laporan kunjungan.', 'Kunjungan [klien]', TaskPriority::Medium, 3,
                ['Konfirmasi jadwal dengan klien', 'Siapkan materi presentasi', 'Lakukan kunjungan', 'Tulis laporan kunjungan'], [['name' => 'Klien', 'color' => 'blue']]],
            [null, 'Laporan bulanan', 'Kerangka laporan bulanan untuk direksi.', 'Laporan bulanan [bulan]', TaskPriority::High, 4,
                ['Kumpulkan data', 'Susun draf', 'Review atasan', 'Kirim ke direksi'], [['name' => 'Laporan', 'color' => 'teal']]],
            [$ops, 'SOP baru', 'Alur menulis dan mengesahkan SOP Operasional.', 'SOP [proses]', TaskPriority::Medium, 6,
                ['Tulis draf SOP', 'Uji coba dengan tim', 'Revisi', 'Pengesahan Kepala Divisi'], [['name' => 'SOP', 'color' => 'violet']]],
        ];

        foreach ($templates as [$workspace, $name, $description, $title, $priority, $estimate, $checklist, $labels]) {
            TaskTemplate::query()->firstOrCreate(
                ['company_id' => $ops->company_id, 'name' => $name],
                [
                    'workspace_id' => $workspace?->id,
                    'description' => $description,
                    'title' => $title,
                    'priority' => $priority,
                    'estimate_hours' => $estimate,
                    'checklist' => $checklist,
                    'labels' => $labels,
                    'created_by' => $kadiv->id,
                ],
            );
        }
    }

    private function workspaceTemplates(Workspace $ops, ?Workspace $plq, User $kadiv): void
    {
        $columns = fn (Workspace $workspace): array => TaskStatus::query()
            ->where('workspace_id', $workspace->id)
            ->orderBy('position')
            ->get(['name', 'category', 'color'])
            ->map(fn (TaskStatus $status): array => ['name' => $status->name, 'category' => $status->category->value, 'color' => $status->color])
            ->all();
        $labels = fn (Workspace $workspace): array => Label::query()
            ->where('workspace_id', $workspace->id)
            ->orderBy('name')
            ->get(['name', 'color'])
            ->map(fn (Label $label): array => ['name' => $label->name, 'color' => $label->color])
            ->all();

        if ($plq !== null) {
            WorkspaceTemplate::query()->firstOrCreate(
                ['company_id' => $plq->company_id, 'name' => 'Proyek peluncuran'],
                ['description' => 'Kolom dan label dari Proyek Peluncuran Q4.', 'type' => WorkspaceType::Project, 'statuses' => $columns($plq), 'labels' => $labels($plq), 'source_workspace_id' => $plq->id, 'created_by' => $kadiv->id],
            );
        }

        WorkspaceTemplate::query()->firstOrCreate(
            ['company_id' => $ops->company_id, 'name' => 'Tim operasional'],
            [
                'description' => 'Alur tim operasional: rencana, dikerjakan, cek atasan, selesai.',
                'type' => WorkspaceType::Team,
                'statuses' => [
                    ['name' => 'Rencana', 'category' => 'todo', 'color' => 'slate'],
                    ['name' => 'Dikerjakan', 'category' => 'in_progress', 'color' => 'amber'],
                    ['name' => 'Cek atasan', 'category' => 'review', 'color' => 'blue'],
                    ['name' => 'Selesai', 'category' => 'done', 'color' => 'teal'],
                ],
                'labels' => $labels($ops),
                'source_workspace_id' => $ops->id,
                'created_by' => $kadiv->id,
            ],
        );
    }
}
