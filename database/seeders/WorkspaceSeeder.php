<?php

namespace Database\Seeders;

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\SaveLabel;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\Lexorank;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Actions\SyncDivisionMembers;
use App\Domain\Workspaces\Actions\SyncTeamMembers;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceMembership;
use App\Events\Tasks\TaskCreated;
use App\Events\Workspaces\WorkspaceCreated;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\ChecklistItem;
use App\Models\Division;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Event;

/**
 * Demo workspaces from the mockups (local/testing): a personal workspace for
 * everyone, one workspace per division (OPS, KEU, …), "Tim Gudang" (GDG,
 * synced with the team) and "Proyek Peluncuran Q4" (PLQ, 9 members from 3
 * divisions) with realistic tasks. Due dates are relative to today so the
 * demo always shows overdue / today / this week groups.
 *
 * Idempotent: workspaces are found by key; tasks are only seeded into a
 * workspace that has none yet. Runs after OrganizationSeeder.
 */
class WorkspaceSeeder extends Seeder
{
    /**
     * key => [name, color] per workspace.
     *
     * @var array<string, array<string, string>>
     */
    private const array LABELS = [
        'PLQ' => [
            'Web' => 'blue', 'Desain' => 'teal', 'Konten' => 'violet', 'Keuangan' => 'green',
            'Operasional' => 'amber', 'Legal' => 'orange', 'Riset' => 'pink', 'Presentasi' => 'amber',
        ],
        'OPS' => ['Keuangan' => 'green', 'Laporan' => 'blue', 'SOP' => 'gray', 'Operasional' => 'amber'],
        'GDG' => ['Shift' => 'amber', 'Riset' => 'blue', 'Stok' => 'teal'],
    ];

    /**
     * Project members besides the owner (Dimas): email => role.
     *
     * @var array<string, WorkspaceRole>
     */
    private const array PROJECT_MEMBERS = [
        'sari.wulandari@demo.test' => WorkspaceRole::Admin,
        'anggota@demo.test' => WorkspaceRole::Member,
        'bayu.saputra@demo.test' => WorkspaceRole::Member,
        'maya.lestari@demo.test' => WorkspaceRole::Member,
        'rendi.oktavian@demo.test' => WorkspaceRole::Member,
        'putri.ramadhani@demo.test' => WorkspaceRole::Viewer,
        'fitri.handayani@demo.test' => WorkspaceRole::Member,
        'ahmad.kurniawan@demo.test' => WorkspaceRole::Member,
    ];

    /**
     * Personal tasks (email => [[title, due offset|null, priority]]).
     *
     * @var array<string, list<array{0: string, 1: int|null, 2: TaskPriority}>>
     */
    private const array PERSONAL_TASKS = [
        'kadiv@demo.test' => [
            ['Siapkan bahan 1:1 dengan Rizky', 2, TaskPriority::Medium],
            ['Baca laporan audit internal Q3', null, TaskPriority::Low],
        ],
        'anggota@demo.test' => [
            ['Perpanjang SIM', 20, TaskPriority::Low],
        ],
    ];

    public function run(): void
    {
        // Seeding must not broadcast, queue Drive jobs or write audit rows. Event::fakeFor()
        // re-installs the real dispatcher on Eloquent afterwards, so the model dispatcher
        // (null under WithoutModelEvents) is saved and restored around it.
        $modelDispatcher = Model::getEventDispatcher();

        Event::fakeFor(function (): void {
            Model::withoutEvents(fn () => $this->seed());
        }, [TaskCreated::class, WorkspaceCreated::class, WorkspaceMembersChanged::class]);

        if ($modelDispatcher === null) {
            Model::unsetEventDispatcher();
        } else {
            Model::setEventDispatcher($modelDispatcher);
        }
    }

    private function seed(): void
    {
        /** @var array<string, User> $users */
        $users = User::query()->get()->keyBy('email')->all();
        $kadiv = $users['kadiv@demo.test'] ?? null;

        // Division workspaces first so division codes (OPS, KEU, …) win the keys.
        Division::query()->orderBy('code')->get()->each(
            fn (Division $division) => app(SyncDivisionMembers::class)->handle($division),
        );

        foreach ($users as $user) {
            app(EnsurePersonalWorkspace::class)->handle($user);
        }

        if ($kadiv === null) {
            return;
        }

        $gudang = $this->teamWorkspace($kadiv);
        $project = $this->projectWorkspace($kadiv, $users);
        $ops = Workspace::query()->where('key', 'OPS')->first();

        foreach (['PLQ' => $project, 'OPS' => $ops, 'GDG' => $gudang] as $key => $workspace) {
            if ($workspace !== null) {
                $this->seedLabels($workspace, self::LABELS[$key]);
                $this->seedTasks($workspace, self::demoTasks()[$key], $users);
            }
        }

        foreach (self::PERSONAL_TASKS as $email => $tasks) {
            $owner = $users[$email] ?? null;
            $personal = $owner !== null ? app(EnsurePersonalWorkspace::class)->handle($owner) : null;

            if ($owner === null || $personal === null || $personal->tasks()->withTrashed()->exists()) {
                continue;
            }

            foreach ($tasks as [$title, $due, $priority]) {
                app(CreateTask::class)->handle($personal, $owner, [
                    'title' => $title,
                    'priority' => $priority,
                    'due_date' => $due === null ? null : $this->today()->addDays($due)->toDateString(),
                    'assignee_ids' => [$owner->id],
                ]);
            }
        }

        // Favorites of the demo Kepala Divisi (sidebar order).
        foreach ([$project, $ops] as $favorite) {
            if ($favorite !== null) {
                $favorite->memberships()->where('user_id', $kadiv->id)->whereNull('favorited_at')->update(['favorited_at' => now()]);
            }
        }
    }

    /**
     * Demo tasks per workspace key (numbers as in the mockups).
     *
     * @return array<string, list<array{number: int, title: string, category: TaskStatusCategory, priority: TaskPriority, due: int|null, assignees: list<string>, labels: list<string>, creator: string, completed_days_ago: int|null, checklist: int, checklist_done: int, parent: int|null}>>
     */
    private static function demoTasks(): array
    {
        return [
            'PLQ' => [
                self::task(12, 'Tentukan tanggal & lokasi acara', TaskStatusCategory::Done, TaskPriority::High, -12, ['kadiv@demo.test'], ['Operasional'], 'kadiv@demo.test', completedDaysAgo: 10),
                self::task(14, 'Brief kreatif kampanye peluncuran', TaskStatusCategory::Done, TaskPriority::Medium, -6, ['maya.lestari@demo.test'], ['Konten'], 'putri.ramadhani@demo.test', completedDaysAgo: 5),
                self::task(15, 'Siaran pers peluncuran', TaskStatusCategory::Review, TaskPriority::High, -2, ['sari.wulandari@demo.test'], ['Konten'], 'kadiv@demo.test'),
                self::task(18, 'Finalisasi anggaran peluncuran', TaskStatusCategory::InProgress, TaskPriority::Urgent, 1, ['kadiv@demo.test'], ['Keuangan'], 'fitri.handayani@demo.test'),
                self::task(19, 'Rencana logistik hari acara', TaskStatusCategory::Review, TaskPriority::Medium, 7, ['bayu.saputra@demo.test'], ['Operasional'], 'sari.wulandari@demo.test'),
                self::task(21, 'Landing page produk baru', TaskStatusCategory::InProgress, TaskPriority::High, 4, ['anggota@demo.test'], ['Web'], 'kadiv@demo.test', checklist: 7, checklistDone: 4),
                self::task(22, 'Siapkan materi presentasi untuk direksi', TaskStatusCategory::Todo, TaskPriority::High, 3, ['kadiv@demo.test'], ['Presentasi'], 'kadiv@demo.test'),
                self::task(24, 'Skrip video demo produk', TaskStatusCategory::InProgress, TaskPriority::Medium, 6, ['maya.lestari@demo.test'], ['Konten'], 'maya.lestari@demo.test'),
                self::task(25, 'Kontrak vendor percetakan materi acara', TaskStatusCategory::Todo, TaskPriority::High, null, ['sari.wulandari@demo.test'], ['Legal'], 'kadiv@demo.test'),
                self::task(27, 'Desain banner & spanduk peluncuran', TaskStatusCategory::Todo, TaskPriority::Medium, 5, ['maya.lestari@demo.test'], ['Desain'], 'putri.ramadhani@demo.test'),
                self::task(29, 'Daftar mitra distribusi tahap 2', TaskStatusCategory::Backlog, TaskPriority::None, null, [], [], 'kadiv@demo.test'),
                self::task(30, 'Kirim undangan ke media mitra', TaskStatusCategory::Todo, TaskPriority::Medium, 10, ['anggota@demo.test'], [], 'sari.wulandari@demo.test'),
                self::task(31, 'Riset harga kompetitor wilayah Jawa Barat', TaskStatusCategory::Backlog, TaskPriority::Medium, null, ['rendi.oktavian@demo.test'], ['Riset'], 'putri.ramadhani@demo.test'),
                self::task(33, 'Integrasi formulir demo ke CRM', TaskStatusCategory::InProgress, TaskPriority::Medium, 3, ['anggota@demo.test'], ['Web'], 'anggota@demo.test', parent: 21),
                self::task(34, 'Ide konten video teaser media sosial', TaskStatusCategory::Backlog, TaskPriority::Medium, null, ['maya.lestari@demo.test'], ['Konten'], 'maya.lestari@demo.test'),
                self::task(35, 'Pengujian aksesibilitas halaman', TaskStatusCategory::Todo, TaskPriority::Low, 4, ['anggota@demo.test'], ['Web'], 'anggota@demo.test', parent: 21),
                self::task(36, 'Evaluasi pascapeluncuran bersama direksi', TaskStatusCategory::Backlog, TaskPriority::Medium, 25, ['kadiv@demo.test'], ['Presentasi'], 'kadiv@demo.test'),
                self::task(38, 'Gladi bersih acara', TaskStatusCategory::Todo, TaskPriority::Medium, 15, ['sari.wulandari@demo.test'], ['Operasional'], 'kadiv@demo.test'),
                self::task(40, 'Hari peluncuran', TaskStatusCategory::Todo, TaskPriority::Urgent, 22, ['kadiv@demo.test'], [], 'kadiv@demo.test'),
            ],
            'OPS' => [
                self::task(125, 'Laporan selisih stok Agustus', TaskStatusCategory::Done, TaskPriority::Medium, -20, ['anggota@demo.test'], ['Laporan'], 'kadiv@demo.test', completedDaysAgo: 3),
                self::task(127, 'Verifikasi tagihan vendor logistik', TaskStatusCategory::InProgress, TaskPriority::High, -1, ['kadiv@demo.test'], ['Keuangan'], 'bayu.saputra@demo.test'),
                self::task(131, 'Jadwal perawatan kendaraan operasional', TaskStatusCategory::Todo, TaskPriority::Low, 11, ['kadiv@demo.test'], ['Operasional'], 'bayu.saputra@demo.test'),
                self::task(138, 'Perbarui SOP penerimaan barang', TaskStatusCategory::InProgress, TaskPriority::Medium, 4, ['kadiv@demo.test'], ['SOP'], 'sari.wulandari@demo.test'),
                self::task(140, 'Tinjau laporan kinerja mingguan tim operasional', TaskStatusCategory::Review, TaskPriority::Medium, 0, ['kadiv@demo.test'], ['Laporan'], 'anggota@demo.test'),
                self::task(142, 'Rekap stok gudang September', TaskStatusCategory::InProgress, TaskPriority::High, -5, ['anggota@demo.test'], ['Laporan'], 'kadiv@demo.test'),
                self::task(143, 'Koordinasi pengiriman ke cabang Bandung', TaskStatusCategory::Todo, TaskPriority::Medium, 2, ['bayu.saputra@demo.test'], ['Operasional'], 'kadiv@demo.test'),
                self::task(144, 'Audit kendaraan operasional kuartal IV', TaskStatusCategory::Backlog, TaskPriority::Low, 18, ['anggota@demo.test'], [], 'kadiv@demo.test'),
                self::task(145, 'Rapat evaluasi pemasok bulanan', TaskStatusCategory::Todo, TaskPriority::Medium, 1, ['anggota@demo.test', 'bayu.saputra@demo.test'], [], 'kadiv@demo.test'),
            ],
            'GDG' => [
                self::task(48, 'Laporan selisih stok rak C', TaskStatusCategory::InProgress, TaskPriority::High, -1, ['sari.wulandari@demo.test'], ['Stok'], 'kadiv@demo.test'),
                self::task(58, 'Setujui jadwal shift gudang minggu depan', TaskStatusCategory::Todo, TaskPriority::High, 0, ['kadiv@demo.test'], ['Shift'], 'sari.wulandari@demo.test'),
                self::task(61, 'Usulan tata letak rak Gudang Cikarang', TaskStatusCategory::Backlog, TaskPriority::None, null, ['kadiv@demo.test'], ['Riset'], 'sari.wulandari@demo.test'),
                self::task(62, 'Cek suhu ruang penyimpanan dingin', TaskStatusCategory::Todo, TaskPriority::Medium, 1, ['nadia.putri@demo.test'], ['Stok'], 'sari.wulandari@demo.test'),
                self::task(63, 'Stock opname mingguan', TaskStatusCategory::InProgress, TaskPriority::Medium, 4, ['yoga.pratama@demo.test'], ['Stok'], 'sari.wulandari@demo.test'),
            ],
        ];
    }

    /**
     * @param  list<string>  $assignees
     * @param  list<string>  $labels
     * @return array{number: int, title: string, category: TaskStatusCategory, priority: TaskPriority, due: int|null, assignees: list<string>, labels: list<string>, creator: string, completed_days_ago: int|null, checklist: int, checklist_done: int, parent: int|null}
     */
    private static function task(
        int $number,
        string $title,
        TaskStatusCategory $category,
        TaskPriority $priority,
        ?int $due,
        array $assignees,
        array $labels,
        string $creator,
        ?int $completedDaysAgo = null,
        int $checklist = 0,
        int $checklistDone = 0,
        ?int $parent = null,
    ): array {
        return [
            'number' => $number,
            'title' => $title,
            'category' => $category,
            'priority' => $priority,
            'due' => $due,
            'assignees' => $assignees,
            'labels' => $labels,
            'creator' => $creator,
            'completed_days_ago' => $completedDaysAgo,
            'checklist' => $checklist,
            'checklist_done' => $checklistDone,
            'parent' => $parent,
        ];
    }

    private function teamWorkspace(User $owner): Workspace
    {
        $team = Team::query()->where('name', 'Tim Gudang')->first();
        $existing = Workspace::query()->where('company_id', $owner->company_id)->where('key', 'GDG')->first();

        if ($existing !== null) {
            if ($team !== null) {
                app(SyncTeamMembers::class)->handle($team);
            }

            return $existing;
        }

        return app(CreateWorkspace::class)->handle($owner, [
            'type' => WorkspaceType::Team,
            'name' => 'Tim Gudang',
            'key' => 'GDG',
            'description' => 'Operasional gudang Cikarang: stok, shift, dan penerimaan barang.',
            'visibility' => WorkspaceVisibility::Private,
            'team_id' => $team?->id,
        ]);
    }

    /**
     * @param  array<string, User>  $users
     */
    private function projectWorkspace(User $owner, array $users): Workspace
    {
        $workspace = Workspace::query()->where('company_id', $owner->company_id)->where('key', 'PLQ')->first()
            ?? app(CreateWorkspace::class)->handle($owner, [
                'type' => WorkspaceType::Project,
                'name' => 'Proyek Peluncuran Q4',
                'key' => 'PLQ',
                'description' => 'Koordinasi lintas divisi untuk peluncuran produk baru: anggaran, materi pemasaran, logistik acara.',
                'visibility' => WorkspaceVisibility::Internal,
            ]);

        $workspace->forceFill([
            'lead_user_id' => $owner->id,
            'sponsor_user_id' => ($users['direksi@demo.test'] ?? null)?->id,
            'start_date' => $workspace->start_date ?? $this->today()->subDays(30),
            'target_date' => $workspace->target_date ?? $this->today()->addDays(22),
            'project_status' => 'active',
        ])->save();

        $membership = app(WorkspaceMembership::class);

        foreach (self::PROJECT_MEMBERS as $email => $role) {
            $member = $users[$email] ?? null;

            if ($member !== null && $workspace->roleOf($member) === null) {
                $membership->put($workspace, $member->id, $role);
            }
        }

        return $workspace;
    }

    /**
     * @param  array<string, string>  $labels
     */
    private function seedLabels(Workspace $workspace, array $labels): void
    {
        foreach ($labels as $name => $color) {
            $label = Label::query()->where('workspace_id', $workspace->id)->where('name', $name)->first();
            app(SaveLabel::class)->handle($workspace, $name, $color, $label);
        }
    }

    /**
     * @param  list<array{number: int, title: string, category: TaskStatusCategory, priority: TaskPriority, due: int|null, assignees: list<string>, labels: list<string>, creator: string, completed_days_ago: int|null, checklist: int, checklist_done: int, parent: int|null}>  $tasks
     * @param  array<string, User>  $users
     */
    private function seedTasks(Workspace $workspace, array $tasks, array $users): void
    {
        if ($workspace->tasks()->withTrashed()->exists()) {
            return;
        }

        $statuses = TaskStatus::query()->where('workspace_id', $workspace->id)->get()->keyBy(fn (TaskStatus $status) => $status->category->value);
        $labels = Label::query()->where('workspace_id', $workspace->id)->pluck('id', 'name');
        $byNumber = [];

        foreach ($tasks as $index => $row) {
            $number = $row['number'];
            $creator = $users[$row['creator']] ?? $workspace->owner;

            // Keep the mockup numbers (e.g. PLQ-18): the seeder skips numbers like deleted tasks would.
            Workspace::query()->whereKey($workspace->id)->update(['task_sequence' => $number - 1]);

            $parent = $row['parent'] !== null ? ($byNumber[$row['parent']] ?? null) : null;

            $task = app(CreateTask::class)->handle($workspace, $creator, [
                'title' => $row['title'],
                'status_id' => $statuses->get($row['category']->value)?->id,
                'priority' => $row['priority'],
                'due_date' => $row['due'] === null ? null : $this->today()->addDays($row['due'])->toDateString(),
                'assignee_ids' => array_values(array_filter(array_map(fn (string $email): ?string => ($users[$email] ?? null)?->id, $row['assignees']))),
                'label_ids' => array_values(array_filter(array_map(fn (string $name): ?string => is_string($labels[$name] ?? null) ? $labels[$name] : null, $row['labels']))),
                'parent_id' => $parent?->id,
            ]);

            $createdAt = now()->subDays(14 - min(13, $index % 14))->subHours($index);

            $task->forceFill([
                'created_at' => $createdAt,
                'started_at' => $task->started_at === null ? null : $createdAt->addDay(),
                'completed_at' => $row['completed_days_ago'] === null ? $task->completed_at : now()->subDays($row['completed_days_ago']),
            ])->saveQuietly();

            $this->seedChecklist($task, $row['checklist'], $row['checklist_done']);

            $byNumber[$number] = $task;
        }

        // Keep the board order of the mockups: lowest number at the top.
        foreach ($statuses as $status) {
            $ids = Task::query()->where('status_id', $status->id)->orderBy('number')->pluck('id')->all();

            foreach (Lexorank::sequence(count($ids)) as $position => $key) {
                Task::query()->whereKey($ids[$position])->update(['position' => $key]);
            }
        }
    }

    private function seedChecklist(Task $task, int $total, int $done): void
    {
        $steps = ['Wireframe', 'Copywriting', 'Desain visual', 'Implementasi', 'Formulir demo', 'Uji aksesibilitas', 'Publikasi'];
        $positions = Lexorank::sequence($total);

        for ($i = 0; $i < $total; $i++) {
            ChecklistItem::query()->create([
                'task_id' => $task->id,
                'title' => $steps[$i] ?? 'Langkah '.($i + 1),
                'is_done' => $i < $done,
                'position' => $positions[$i],
                'done_at' => $i < $done ? now()->subDays($total - $i) : null,
            ]);
        }
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now(config()->string('app.office_timezone'))->startOfDay();
    }
}
