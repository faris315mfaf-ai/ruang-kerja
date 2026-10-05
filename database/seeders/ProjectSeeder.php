<?php

namespace Database\Seeders;

use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Enums\RiskLevel;
use App\Domain\Projects\Enums\RiskStatus;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\Lexorank;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceMembership;
use App\Events\Tasks\TaskCreated;
use App\Events\Workspaces\WorkspaceCreated;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Division;
use App\Models\Milestone;
use App\Models\ProjectDirection;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/**
 * Demo portfolio (mockups DashboardDireksi / ProyekDetail, Sprint 9): six
 * running projects (RKR, PLQ, ANG, KTR, AUD, MSG) and two finished ones (IRK,
 * SOPK) with milestones, weekly PIC updates, risks, Direksi directions and a
 * daily burn-up snapshot history (± 6 months). Dates are relative to today.
 *
 * Idempotent: a project that already has updates is left untouched. Runs
 * after WorkspaceSeeder (PLQ and its tasks come from there).
 *
 * @phpstan-type TaskRow array{0: string, 1: TaskStatusCategory, 2: int|null, 3: string}
 * @phpstan-type MilestoneRow array{name: string, target: int, completed: int|null, tasks: list<string>}
 * @phpstan-type UpdateRow array{days_ago: int, health: ProjectHealth, summary: string, blockers: string|null, decision: string|null, resolved: bool}
 * @phpstan-type RiskRow array{0: string, 1: RiskLevel, 2: string, 3: string|null, 4: bool}
 * @phpstan-type ProjectDef array{name: string, color: string, division: string, description: string, lead: string, sponsor: string, members: list<string>, start: int, target: int, completed: int|null, initial_scope: float, history_health: ProjectHealth, tasks: list<TaskRow>, milestones: list<MilestoneRow>, updates: non-empty-list<UpdateRow>, risks: list<RiskRow>, directions: list<array{0: string, 1: string, 2: int}>}
 */
class ProjectSeeder extends Seeder
{
    public function run(): void
    {
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

        if (! isset($users['direksi@demo.test'], $users['kadiv@demo.test'])) {
            return;
        }

        /** @var array<string, string> $divisions code => id */
        $divisions = Division::query()->pluck('id', 'code')->all();

        foreach (self::projects() as $key => $project) {
            $lead = $users[$project['lead']] ?? null;

            if ($lead === null) {
                continue;
            }

            $workspace = Workspace::query()->where('company_id', $lead->company_id)->where('key', $key)->first();

            if ($workspace !== null && $workspace->projectUpdates()->exists()) {
                continue;
            }

            $workspace ??= app(CreateWorkspace::class)->handle($lead, [
                'type' => WorkspaceType::Project,
                'name' => $project['name'],
                'key' => $key,
                'description' => $project['description'],
                'visibility' => WorkspaceVisibility::Private,
                'color' => $project['color'],
            ]);

            $membership = app(WorkspaceMembership::class);

            foreach ($project['members'] as $email) {
                $member = $users[$email] ?? null;

                if ($member !== null && $workspace->roleOf($member) === null) {
                    $membership->put($workspace, $member->id, WorkspaceRole::Member);
                }
            }

            // The PIC needs at least admin rights inside the workspace.
            if (in_array($workspace->roleOf($lead), [null, WorkspaceRole::Member, WorkspaceRole::Viewer], true)) {
                $membership->put($workspace, $lead->id, WorkspaceRole::Admin);
            }

            $start = $this->day($project['start']);
            $status = $project['completed'] !== null ? ProjectStatus::Completed : ProjectStatus::Active;

            $workspace->forceFill([
                'lead_user_id' => $lead->id,
                'sponsor_user_id' => ($users[$project['sponsor']] ?? null)?->id,
                'division_id' => $divisions[$project['division']] ?? null,
                'start_date' => $start->toDateString(),
                'target_date' => $this->day($project['target'])->toDateString(),
                'project_status' => $status,
                'completed_at' => $project['completed'] !== null ? $this->day($project['completed'])->setTime(16, 0) : null,
                'created_at' => $start->subDays(3),
            ])->save();

            $this->seedTasks($workspace, $project['tasks'], $users, $start);
            $this->seedMilestones($workspace, $project['milestones']);
            $this->seedUpdates($workspace, $lead, $project, $start);
            $this->seedRisks($workspace, $project['risks'], $users);
            $this->seedDirections($workspace, $project['directions'], $users);
            $this->seedSnapshots($workspace, $project, $start);
        }
    }

    /**
     * @param  list<TaskRow>  $tasks
     * @param  array<string, User>  $users
     */
    private function seedTasks(Workspace $workspace, array $tasks, array $users, CarbonImmutable $start): void
    {
        $existing = $workspace->tasks()->withTrashed()->pluck('title')->all();
        $statuses = TaskStatus::query()->where('workspace_id', $workspace->id)->get()->keyBy(fn (TaskStatus $status) => $status->category->value);
        $done = 0;

        foreach ($tasks as $index => [$title, $category, $due, $assignee]) {
            if (in_array($title, $existing, true)) {
                continue;
            }

            $creator = $users[$assignee] ?? $workspace->owner;
            $task = app(CreateTask::class)->handle($workspace, $creator, [
                'title' => $title,
                'status_id' => $statuses->get($category->value)?->id,
                'priority' => [TaskPriority::High, TaskPriority::Medium, TaskPriority::Medium, TaskPriority::Low][$index % 4],
                'due_date' => $due === null ? null : $this->day($due)->toDateString(),
                'assignee_ids' => isset($users[$assignee]) ? [$users[$assignee]->id] : [],
            ]);

            $createdAt = $start->addDays(min($index * 2, max(0, (int) $start->diffInDays($this->today()) - 1)))->setTime(9, 0);
            $completedAt = null;

            if ($category === TaskStatusCategory::Done) {
                $completedAt = $due !== null ? $this->day(min($due, -1))->setTime(15, 0) : $createdAt->addDays(5 + $done * 3);
                $completedAt = $completedAt->lt($createdAt) ? $createdAt->addDay() : ($completedAt->gt(now()) ? now()->subHour()->toImmutable() : $completedAt);
                $done++;
            }

            $task->forceFill([
                'created_at' => $createdAt,
                'started_at' => $task->started_at === null ? null : $createdAt->addDay(),
                'completed_at' => $completedAt ?? $task->completed_at,
            ])->saveQuietly();
        }

        foreach ($statuses as $status) {
            $ids = Task::query()->where('status_id', $status->id)->orderBy('number')->pluck('id')->all();

            foreach (Lexorank::sequence(count($ids)) as $position => $key) {
                Task::query()->whereKey($ids[$position])->update(['position' => $key]);
            }
        }
    }

    /**
     * @param  list<MilestoneRow>  $milestones
     */
    private function seedMilestones(Workspace $workspace, array $milestones): void
    {
        if ($workspace->milestones()->exists()) {
            return;
        }

        $positions = Lexorank::sequence(count($milestones));

        foreach ($milestones as $index => $row) {
            $milestone = Milestone::query()->create([
                'workspace_id' => $workspace->id,
                'name' => $row['name'],
                'target_date' => $this->day($row['target'])->toDateString(),
                'completed_at' => $row['completed'] !== null ? $this->day($row['completed'])->setTime(16, 0) : null,
                'position' => $positions[$index],
                'created_by' => $workspace->lead_user_id,
            ]);

            $taskIds = Task::query()->where('workspace_id', $workspace->id)->whereIn('title', $row['tasks'])->pluck('id')->all();
            $milestone->tasks()->sync($taskIds);
        }
    }

    /**
     * Weekly updates from the first week until the last update day. Older ones
     * use generic texts; the latest come from the project definition.
     *
     * @param  ProjectDef  $project
     */
    private function seedUpdates(Workspace $workspace, User $lead, array $project, CarbonImmutable $start): void
    {
        $latest = $project['updates'];
        $lastDaysAgo = $latest[0]['days_ago'];
        $endDay = $project['completed'] !== null ? $this->day($project['completed']) : $this->today()->subDays($lastDaysAgo);
        $explicitDays = array_map(fn (array $update): int => $update['days_ago'], $latest);
        $generic = [
            'Kickoff selesai, pembagian peran dan jadwal disepakati.',
            'Pekerjaan berjalan sesuai rencana minggu ini.',
            'Beberapa tugas selesai lebih cepat; tim fokus ke tahap berikutnya.',
            'Koordinasi lintas divisi lancar, tidak ada hambatan besar.',
            'Progres stabil; satu tugas tertunda menunggu masukan.',
        ];

        $rows = [];
        $week = 0;

        for ($day = $start->addDays(4); $day->lt($endDay); $day = $day->addWeek()) {
            $daysAgo = (int) $day->diffInDays($this->today());

            $nearExplicit = array_filter($explicitDays, fn (int $explicit): bool => abs($explicit - $daysAgo) <= 2) !== [];

            if ($nearExplicit || $daysAgo <= $lastDaysAgo + 2) {
                continue;
            }

            $rows[] = [
                'created_at' => $day->setTime(16, 30),
                'health' => $project['history_health'],
                'summary' => $generic[$week % count($generic)],
                'blockers' => null,
                'decision' => null,
                'resolved' => true,
            ];
            $week++;
        }

        foreach (array_reverse($latest) as $update) {
            $rows[] = [
                'created_at' => $this->today()->subDays($update['days_ago'])->setTime(16, 0),
                'health' => $update['health'],
                'summary' => $update['summary'],
                'blockers' => $update['blockers'],
                'decision' => $update['decision'],
                'resolved' => $update['resolved'],
            ];
        }

        $direksi = User::query()->where('email', $project['sponsor'])->value('id');

        foreach ($rows as $row) {
            $last = ProjectUpdate::query()->create([
                'workspace_id' => $workspace->id,
                'author_id' => $lead->id,
                'health' => $row['health'],
                'summary' => $row['summary'],
                'blockers' => $row['blockers'],
                'decision_needed' => $row['decision'],
                'decision_resolved_at' => $row['decision'] !== null && $row['resolved'] ? $row['created_at']->addDay() : null,
                'decision_resolved_by' => $row['decision'] !== null && $row['resolved'] ? $direksi : null,
                'created_at' => $row['created_at'],
                'updated_at' => $row['created_at'],
            ]);
        }

        $workspace->forceFill(['health' => $last->health, 'last_update_at' => $last->created_at])->save();
    }

    /**
     * @param  list<RiskRow>  $risks
     * @param  array<string, User>  $users
     */
    private function seedRisks(Workspace $workspace, array $risks, array $users): void
    {
        foreach ($risks as [$title, $level, $owner, $taskTitle, $resolved]) {
            ProjectRisk::query()->create([
                'workspace_id' => $workspace->id,
                'title' => $title,
                'level' => $level,
                'owner_id' => ($users[$owner] ?? null)?->id,
                'task_id' => $taskTitle !== null ? Task::query()->where('workspace_id', $workspace->id)->where('title', $taskTitle)->value('id') : null,
                'status' => $resolved ? RiskStatus::Resolved : RiskStatus::Open,
                'resolved_at' => $resolved ? now()->subDays(10) : null,
            ]);
        }
    }

    /**
     * @param  list<array{0: string, 1: string, 2: int}>  $directions
     * @param  array<string, User>  $users
     */
    private function seedDirections(Workspace $workspace, array $directions, array $users): void
    {
        foreach ($directions as [$author, $body, $daysAgo]) {
            $at = $this->today()->subDays($daysAgo)->setTime(10, 0);
            $update = ProjectUpdate::query()->where('workspace_id', $workspace->id)->where('created_at', '<=', $at)->latest('created_at')->first();

            ProjectDirection::query()->create([
                'workspace_id' => $workspace->id,
                'project_update_id' => $update?->id,
                'author_id' => ($users[$author] ?? null)?->id,
                'body' => $body,
                'created_at' => $at,
                'updated_at' => $at,
            ]);
        }
    }

    /**
     * Daily burn-up history until yesterday (or the completion day): scope grows
     * from the initial scope to today's scope in the first 70% of the elapsed
     * time; done follows an S-curve towards today's done count.
     *
     * @param  ProjectDef  $project
     */
    private function seedSnapshots(Workspace $workspace, array $project, CarbonImmutable $start): void
    {
        $scope = Task::query()->where('workspace_id', $workspace->id)->where('status_category', '!=', TaskStatusCategory::Canceled->value)->count();
        $done = Task::query()->where('workspace_id', $workspace->id)->where('status_category', TaskStatusCategory::Done->value)->count();
        $end = $project['completed'] !== null ? $this->day($project['completed']) : $this->today()->subDay();
        $days = max(1, (int) $start->diffInDays($end));
        $initial = (int) round($scope * $project['initial_scope']);
        $rows = [];

        for ($day = $start, $i = 0; $day->lte($end); $day = $day->addDay(), $i++) {
            $t = $i / $days;
            $scopeAt = (int) round($initial + ($scope - $initial) * min(1, $t / 0.7));
            $doneAt = (int) min($scopeAt, round($done * ($t ** 1.3)));
            $rows[] = [
                'workspace_id' => $workspace->id,
                'date' => $day->toDateString(),
                'scope_count' => $scopeAt,
                'done_count' => $doneAt,
                'scope_hours' => null,
                'done_hours' => null,
                'created_at' => $day->setTime(23, 55),
                'updated_at' => $day->setTime(23, 55),
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('project_progress_snapshots')->upsert($chunk, ['workspace_id', 'date'], ['scope_count', 'done_count', 'updated_at']);
        }
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now(config()->string('app.office_timezone'))->startOfDay();
    }

    private function day(int $offset): CarbonImmutable
    {
        return $this->today()->addDays($offset);
    }

    /**
     * Project definitions (offsets in days relative to today).
     *
     * @return array<string, ProjectDef>
     */
    private static function projects(): array
    {
        $d = TaskStatusCategory::Done;
        $p = TaskStatusCategory::InProgress;
        $r = TaskStatusCategory::Review;
        $t = TaskStatusCategory::Todo;
        $b = TaskStatusCategory::Backlog;

        return [
            'RKR' => [
                'name' => 'Rekrutmen 6 staf gudang', 'color' => 'red', 'division' => 'SDM',
                'description' => 'Rekrutmen enam staf gudang Cikarang sebelum musim puncak akhir tahun.',
                'lead' => 'hr@demo.test', 'sponsor' => 'direksi@demo.test',
                'members' => ['dewi.kartika@demo.test', 'rahmawati@demo.test', 'sari.wulandari@demo.test', 'kadiv@demo.test'],
                'start' => -40, 'target' => 26, 'completed' => null, 'initial_scope' => 0.8, 'history_health' => ProjectHealth::AtRisk,
                'tasks' => [
                    ['Susun profil jabatan staf gudang', $d, -35, 'dewi.kartika@demo.test'],
                    ['Publikasi lowongan di portal kerja', $d, -30, 'dewi.kartika@demo.test'],
                    ['Kerja sama dengan BLK Cikarang', $d, -20, 'rahmawati@demo.test'],
                    ['Seleksi berkas pelamar', $p, -8, 'dewi.kartika@demo.test'],
                    ['Psikotes kandidat', $t, -6, 'rahmawati@demo.test'],
                    ['Shortlist kandidat', $r, -5, 'hr@demo.test'],
                    ['Wawancara user bersama Ketua Tim Gudang', $t, -2, 'sari.wulandari@demo.test'],
                    ['Wawancara tahap 2', $t, 4, 'hr@demo.test'],
                    ['Pemeriksaan kesehatan', $b, 12, 'rahmawati@demo.test'],
                    ['Penawaran kerja', $b, 18, 'hr@demo.test'],
                    ['Kontrak kerja ditandatangani', $b, 26, 'hr@demo.test'],
                    ['Orientasi staf baru', $b, null, 'sari.wulandari@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'Lowongan dipublikasikan', 'target' => -30, 'completed' => -30, 'tasks' => ['Publikasi lowongan di portal kerja']],
                    ['name' => 'Shortlist kandidat', 'target' => -5, 'completed' => null, 'tasks' => ['Shortlist kandidat', 'Seleksi berkas pelamar']],
                    ['name' => 'Wawancara tahap 2', 'target' => 4, 'completed' => null, 'tasks' => ['Wawancara tahap 2']],
                    ['name' => 'Kontrak ditandatangani', 'target' => 26, 'completed' => null, 'tasks' => ['Kontrak kerja ditandatangani']],
                ],
                'updates' => [
                    ['days_ago' => 9, 'health' => ProjectHealth::OffTrack, 'summary' => 'Pelamar yang lolos berkas baru 9 orang, jauh di bawah target 30. Shortlist mundur.', 'blockers' => 'Gaji yang ditawarkan di bawah pasar Cikarang.', 'decision' => null, 'resolved' => false],
                ],
                'risks' => [
                    ['Gaji di bawah pasar sehingga pelamar sedikit', RiskLevel::High, 'hr@demo.test', null, false],
                    ['Kandidat mundur setelah penawaran', RiskLevel::Medium, 'dewi.kartika@demo.test', 'Penawaran kerja', false],
                ],
                'directions' => [],
            ],
            'PLQ' => [
                'name' => 'Proyek Peluncuran Q4', 'color' => 'violet', 'division' => 'PMS',
                'description' => 'Koordinasi lintas divisi untuk peluncuran produk baru: anggaran, materi pemasaran, logistik acara.',
                'lead' => 'putri.ramadhani@demo.test', 'sponsor' => 'direksi@demo.test',
                'members' => [],
                'start' => -34, 'target' => 22, 'completed' => null, 'initial_scope' => 0.7, 'history_health' => ProjectHealth::OnTrack,
                'tasks' => [
                    ['Konsep kreatif kampanye', $d, -26, 'maya.lestari@demo.test'],
                    ['Anggaran peluncuran disetujui', $d, -24, 'fitri.handayani@demo.test'],
                    ['Riset tema acara', $d, -22, 'rendi.oktavian@demo.test'],
                    ['Daftar media mitra', $d, -18, 'anggota@demo.test'],
                    ['Survei venue acara', $d, -14, 'bayu.saputra@demo.test'],
                    ['Negosiasi vendor percetakan', $d, -10, 'sari.wulandari@demo.test'],
                    ['Kontrak venue ditandatangani', $d, -5, 'kadiv@demo.test'],
                    ['Moodboard visual peluncuran', $d, -9, 'maya.lestari@demo.test'],
                    ['Rencana konten media sosial', $d, -7, 'rendi.oktavian@demo.test'],
                    ['Draf siaran pers', $d, -6, 'sari.wulandari@demo.test'],
                    ['Foto produk untuk katalog', $d, -4, 'maya.lestari@demo.test'],
                    ['Daftar tamu undangan VIP', $p, -1, 'putri.ramadhani@demo.test'],
                    ['Brief fotografer acara', $t, -1, 'maya.lestari@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'Konsep & anggaran disetujui', 'target' => -23, 'completed' => -24, 'tasks' => ['Konsep kreatif kampanye', 'Anggaran peluncuran disetujui']],
                    ['name' => 'Venue & vendor terkunci', 'target' => -5, 'completed' => -4, 'tasks' => ['Kontrak venue ditandatangani', 'Negosiasi vendor percetakan']],
                    ['name' => 'Siaran pers final', 'target' => -4, 'completed' => null, 'tasks' => ['Siaran pers peluncuran']],
                    ['name' => 'Materi & landing page siap', 'target' => 9, 'completed' => null, 'tasks' => ['Landing page produk baru', 'Siapkan materi presentasi untuk direksi', 'Desain banner & spanduk peluncuran']],
                    ['name' => 'Gladi bersih', 'target' => 15, 'completed' => null, 'tasks' => ['Gladi bersih acara']],
                    ['name' => 'Hari peluncuran', 'target' => 22, 'completed' => null, 'tasks' => ['Hari peluncuran']],
                ],
                'updates' => [
                    ['days_ago' => 2, 'health' => ProjectHealth::AtRisk, 'summary' => 'Landing page 4/7 bagian. Materi 14 Okt masih bisa dikejar bila kutipan masuk Selasa.', 'blockers' => 'Siaran pers tertahan menunggu kutipan direksi.', 'decision' => 'Mohon keputusan tambahan anggaran vendor video [nominal].', 'resolved' => false],
                    ['days_ago' => 9, 'health' => ProjectHealth::OnTrack, 'summary' => 'Venue terkunci, negosiasi vendor percetakan berjalan.', 'blockers' => null, 'decision' => 'Kutipan direksi untuk siaran pers: mohon dikirim sebelum Kamis.', 'resolved' => false],
                    ['days_ago' => 16, 'health' => ProjectHealth::OnTrack, 'summary' => 'Konsep kreatif final disetujui.', 'blockers' => null, 'decision' => null, 'resolved' => false],
                ],
                'risks' => [
                    ['Kutipan direksi belum diterima', RiskLevel::High, 'direksi@demo.test', 'Siaran pers peluncuran', false],
                    ['Kontrak vendor percetakan belum ditandatangani', RiskLevel::Medium, 'sari.wulandari@demo.test', 'Kontrak vendor percetakan materi acara', false],
                    ['Anggaran vendor video melebihi rencana', RiskLevel::Medium, 'fitri.handayani@demo.test', null, false],
                    ['Venue penuh di tanggal peluncuran', RiskLevel::Low, 'bayu.saputra@demo.test', null, true],
                ],
                'directions' => [
                    ['direksi@demo.test', 'Prioritaskan landing page; materi presentasi boleh versi ringkas dulu.', 8],
                ],
            ],
            'ANG' => [
                'name' => 'Penyusunan anggaran 2027', 'color' => 'amber', 'division' => 'KEU',
                'description' => 'Anggaran perusahaan 2027 per divisi sampai persetujuan Direksi.',
                'lead' => 'agus.setiawan@demo.test', 'sponsor' => 'lestari.anggraini@demo.test',
                'members' => ['fitri.handayani@demo.test', 'ahmad.kurniawan@demo.test', 'kadiv@demo.test', 'putri.ramadhani@demo.test', 'hr@demo.test'],
                'start' => -20, 'target' => 60, 'completed' => null, 'initial_scope' => 0.9, 'history_health' => ProjectHealth::OnTrack,
                'tasks' => [
                    ['Template anggaran per divisi', $d, -15, 'fitri.handayani@demo.test'],
                    ['Asumsi makro 2027', $d, -10, 'agus.setiawan@demo.test'],
                    ['Realisasi anggaran Q1–Q3', $p, -3, 'ahmad.kurniawan@demo.test'],
                    ['Rekap kebutuhan SDM 2027', $t, -1, 'hr@demo.test'],
                    ['Draf anggaran per divisi', $t, 10, 'fitri.handayani@demo.test'],
                    ['Review anggaran Operasional', $b, 20, 'kadiv@demo.test'],
                    ['Review anggaran Pemasaran', $b, 22, 'putri.ramadhani@demo.test'],
                    ['Konsolidasi anggaran', $b, 35, 'agus.setiawan@demo.test'],
                    ['Presentasi ke Direksi', $b, 50, 'agus.setiawan@demo.test'],
                    ['Revisi pasca presentasi', $b, 55, 'fitri.handayani@demo.test'],
                    ['Anggaran final disahkan', $b, 60, 'agus.setiawan@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'Draf anggaran per divisi', 'target' => 10, 'completed' => null, 'tasks' => ['Draf anggaran per divisi']],
                    ['name' => 'Konsolidasi selesai', 'target' => 35, 'completed' => null, 'tasks' => ['Konsolidasi anggaran']],
                    ['name' => 'Anggaran disahkan', 'target' => 60, 'completed' => null, 'tasks' => ['Anggaran final disahkan']],
                ],
                'updates' => [
                    ['days_ago' => 6, 'health' => ProjectHealth::AtRisk, 'summary' => 'Realisasi Q3 terlambat masuk dari dua divisi; template sudah dibagikan.', 'blockers' => 'Data realisasi Pemasaran belum lengkap.', 'decision' => null, 'resolved' => false],
                ],
                'risks' => [
                    ['Data realisasi divisi terlambat', RiskLevel::Medium, 'ahmad.kurniawan@demo.test', 'Realisasi anggaran Q1–Q3', false],
                ],
                'directions' => [],
            ],
            'KTR' => [
                'name' => 'Renovasi kantor lantai 2', 'color' => 'teal', 'division' => 'OPS',
                'description' => 'Renovasi ruang kerja lantai 2: pengecatan, listrik, furnitur.',
                'lead' => 'kadiv@demo.test', 'sponsor' => 'direksi@demo.test',
                'members' => ['bayu.saputra@demo.test', 'anggota@demo.test', 'fitri.handayani@demo.test'],
                'start' => -65, 'target' => 25, 'completed' => null, 'initial_scope' => 0.85, 'history_health' => ProjectHealth::OnTrack,
                'tasks' => [
                    ['Desain tata ruang', $d, -60, 'kadiv@demo.test'],
                    ['Tender kontraktor', $d, -52, 'bayu.saputra@demo.test'],
                    ['Kontrak kontraktor', $d, -45, 'kadiv@demo.test'],
                    ['Pindahkan tim ke lantai 3 sementara', $d, -40, 'anggota@demo.test'],
                    ['Bongkar partisi lama', $d, -35, 'bayu.saputra@demo.test'],
                    ['Instalasi listrik baru', $d, -25, 'bayu.saputra@demo.test'],
                    ['Instalasi jaringan', $d, -20, 'anggota@demo.test'],
                    ['Pengecatan dinding', $d, -12, 'bayu.saputra@demo.test'],
                    ['Pemasangan plafon', $d, -10, 'bayu.saputra@demo.test'],
                    ['Pemasangan AC', $d, -8, 'anggota@demo.test'],
                    ['Pembayaran termin 2', $d, -6, 'fitri.handayani@demo.test'],
                    ['Uji instalasi listrik', $d, -4, 'bayu.saputra@demo.test'],
                    ['Pembersihan area kerja', $d, -3, 'anggota@demo.test'],
                    ['Pengadaan furnitur', $p, 10, 'kadiv@demo.test'],
                    ['Pemasangan furnitur', $t, 18, 'bayu.saputra@demo.test'],
                    ['Serah terima', $t, 25, 'kadiv@demo.test'],
                    ['Pindahkan tim kembali', $b, 28, 'anggota@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'Kontraktor terpilih', 'target' => -45, 'completed' => -45, 'tasks' => ['Kontrak kontraktor']],
                    ['name' => 'Pekerjaan sipil & listrik selesai', 'target' => -4, 'completed' => -4, 'tasks' => ['Instalasi listrik baru', 'Pengecatan dinding']],
                    ['name' => 'Serah terima', 'target' => 25, 'completed' => null, 'tasks' => ['Serah terima', 'Pemasangan furnitur']],
                ],
                'updates' => [
                    ['days_ago' => 3, 'health' => ProjectHealth::OnTrack, 'summary' => 'Pengecatan & instalasi listrik selesai. Tinggal furnitur.', 'blockers' => null, 'decision' => null, 'resolved' => false],
                ],
                'risks' => [
                    ['Furnitur impor terlambat datang', RiskLevel::Low, 'kadiv@demo.test', 'Pengadaan furnitur', false],
                ],
                'directions' => [],
            ],
            'AUD' => [
                'name' => 'Persiapan audit eksternal 2026', 'color' => 'green', 'division' => 'KEU',
                'description' => 'Menyiapkan dokumen pendukung dan rekonsiliasi untuk auditor eksternal.',
                'lead' => 'agus.setiawan@demo.test', 'sponsor' => 'lestari.anggraini@demo.test',
                'members' => ['fitri.handayani@demo.test', 'ahmad.kurniawan@demo.test'],
                'start' => -52, 'target' => 39, 'completed' => null, 'initial_scope' => 0.9, 'history_health' => ProjectHealth::OnTrack,
                'tasks' => [
                    ['Daftar dokumen permintaan auditor', $d, -48, 'agus.setiawan@demo.test'],
                    ['Rekonsiliasi bank Q1', $d, -40, 'ahmad.kurniawan@demo.test'],
                    ['Rekonsiliasi bank Q2', $d, -32, 'ahmad.kurniawan@demo.test'],
                    ['Daftar aset tetap', $d, -28, 'fitri.handayani@demo.test'],
                    ['Konfirmasi piutang', $d, -22, 'fitri.handayani@demo.test'],
                    ['Konfirmasi utang', $d, -18, 'ahmad.kurniawan@demo.test'],
                    ['Rekap kontrak vendor', $d, -14, 'fitri.handayani@demo.test'],
                    ['Arsip faktur pajak', $d, -10, 'ahmad.kurniawan@demo.test'],
                    ['Pemeriksaan kas kecil', $d, -7, 'fitri.handayani@demo.test'],
                    ['Rekap gaji & BPJS', $d, -5, 'ahmad.kurniawan@demo.test'],
                    ['Rekonsiliasi saldo Q3', $p, 7, 'ahmad.kurniawan@demo.test'],
                    ['Catatan atas laporan keuangan', $t, 15, 'agus.setiawan@demo.test'],
                    ['Uji petik transaksi', $t, 20, 'fitri.handayani@demo.test'],
                    ['Ruang kerja auditor', $t, 30, 'agus.setiawan@demo.test'],
                    ['Rapat pembukaan audit', $b, 32, 'agus.setiawan@demo.test'],
                    ['Tanggapan temuan awal', $b, 39, 'agus.setiawan@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'Dokumen pendukung terkumpul', 'target' => -5, 'completed' => -6, 'tasks' => ['Rekap kontrak vendor']],
                    ['name' => 'Rekonsiliasi saldo Q3', 'target' => 7, 'completed' => null, 'tasks' => ['Rekonsiliasi saldo Q3']],
                    ['name' => 'Rapat pembukaan audit', 'target' => 32, 'completed' => null, 'tasks' => ['Rapat pembukaan audit']],
                ],
                'updates' => [
                    ['days_ago' => 4, 'health' => ProjectHealth::OnTrack, 'summary' => 'Dokumen pendukung 70% terkumpul.', 'blockers' => null, 'decision' => null, 'resolved' => false],
                ],
                'risks' => [],
                'directions' => [],
            ],
            'MSG' => [
                'name' => 'Migrasi sistem gudang', 'color' => 'blue', 'division' => 'OPS',
                'description' => 'Pindah dari spreadsheet stok ke sistem gudang baru, termasuk 1.240 SKU.',
                'lead' => 'sari.wulandari@demo.test', 'sponsor' => 'direksi@demo.test',
                'members' => ['nadia.putri@demo.test', 'yoga.pratama@demo.test', 'kadiv@demo.test', 'anggota@demo.test'],
                'start' => -34, 'target' => 53, 'completed' => null, 'initial_scope' => 0.75, 'history_health' => ProjectHealth::OnTrack,
                'tasks' => [
                    ['Pilih vendor sistem gudang', $d, -30, 'kadiv@demo.test'],
                    ['Kebutuhan laporan stok', $d, -26, 'sari.wulandari@demo.test'],
                    ['Instalasi server', $d, -20, 'anggota@demo.test'],
                    ['Mapping kode SKU', $d, -12, 'nadia.putri@demo.test'],
                    ['Pelatihan admin gudang', $d, -9, 'sari.wulandari@demo.test'],
                    ['Konfigurasi lokasi rak', $d, -6, 'yoga.pratama@demo.test'],
                    ['Import data pemasok', $d, -3, 'nadia.putri@demo.test'],
                    ['Mapping 1.240 SKU', $p, 3, 'nadia.putri@demo.test'],
                    ['Label barcode rak', $t, -1, 'yoga.pratama@demo.test'],
                    ['Uji coba data stok', $t, 11, 'sari.wulandari@demo.test'],
                    ['Uji coba penerimaan barang', $t, 20, 'yoga.pratama@demo.test'],
                    ['Uji coba pengiriman', $b, 28, 'nadia.putri@demo.test'],
                    ['Pelatihan staf gudang', $b, 35, 'sari.wulandari@demo.test'],
                    ['Paralel run dua minggu', $b, 45, 'sari.wulandari@demo.test'],
                    ['Go-live', $b, 50, 'kadiv@demo.test'],
                    ['Evaluasi pasca go-live', $b, 53, 'sari.wulandari@demo.test'],
                    ['Dokumentasi SOP sistem', $b, null, 'yoga.pratama@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'Sistem terpasang', 'target' => -20, 'completed' => -20, 'tasks' => ['Instalasi server']],
                    ['name' => 'Uji coba data stok', 'target' => 11, 'completed' => null, 'tasks' => ['Uji coba data stok', 'Mapping 1.240 SKU']],
                    ['name' => 'Go-live', 'target' => 50, 'completed' => null, 'tasks' => ['Go-live']],
                ],
                'updates' => [
                    ['days_ago' => 1, 'health' => ProjectHealth::OnTrack, 'summary' => 'Mapping 1.240 SKU selesai 90%. Uji coba data stok tetap sesuai jadwal.', 'blockers' => null, 'decision' => null, 'resolved' => false],
                ],
                'risks' => [
                    ['Data stok lama tidak konsisten', RiskLevel::Medium, 'nadia.putri@demo.test', 'Mapping 1.240 SKU', false],
                ],
                'directions' => [],
            ],
            'IRK' => [
                'name' => 'Implementasi RuangKerja tahap 1', 'color' => 'slate', 'division' => 'SDM',
                'description' => 'Peluncuran aplikasi kantor internal: absensi, pengajuan, workspace.',
                'lead' => 'hr@demo.test', 'sponsor' => 'direksi@demo.test',
                'members' => ['kadiv@demo.test', 'agus.setiawan@demo.test'],
                'start' => -190, 'target' => -25, 'completed' => -22, 'initial_scope' => 0.6, 'history_health' => ProjectHealth::OnTrack,
                'tasks' => [
                    ['Kebutuhan modul absensi', $d, -180, 'hr@demo.test'],
                    ['Kebutuhan modul pengajuan', $d, -170, 'hr@demo.test'],
                    ['Uji coba pilot divisi Operasional', $d, -90, 'kadiv@demo.test'],
                    ['Pelatihan seluruh karyawan', $d, -45, 'hr@demo.test'],
                    ['Go-live seluruh divisi', $d, -25, 'hr@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'Go-live', 'target' => -25, 'completed' => -22, 'tasks' => ['Go-live seluruh divisi']],
                ],
                'updates' => [
                    ['days_ago' => 22, 'health' => ProjectHealth::OnTrack, 'summary' => 'Go-live selesai, seluruh divisi memakai RuangKerja.', 'blockers' => null, 'decision' => null, 'resolved' => false],
                ],
                'risks' => [],
                'directions' => [],
            ],
            'SOPK' => [
                'name' => 'Pembaruan SOP keuangan', 'color' => 'green', 'division' => 'KEU',
                'description' => 'Revisi SOP pengadaan, pembayaran, dan kas kecil.',
                'lead' => 'agus.setiawan@demo.test', 'sponsor' => 'lestari.anggraini@demo.test',
                'members' => ['fitri.handayani@demo.test'],
                'start' => -120, 'target' => -40, 'completed' => -36, 'initial_scope' => 0.8, 'history_health' => ProjectHealth::OnTrack,
                'tasks' => [
                    ['Inventaris SOP lama', $d, -110, 'fitri.handayani@demo.test'],
                    ['Draf SOP pengadaan', $d, -90, 'fitri.handayani@demo.test'],
                    ['Draf SOP pembayaran', $d, -70, 'agus.setiawan@demo.test'],
                    ['Pengesahan SOP', $d, -40, 'agus.setiawan@demo.test'],
                ],
                'milestones' => [
                    ['name' => 'SOP disahkan', 'target' => -40, 'completed' => -36, 'tasks' => ['Pengesahan SOP']],
                ],
                'updates' => [
                    ['days_ago' => 36, 'health' => ProjectHealth::OnTrack, 'summary' => 'Seluruh SOP disahkan dan disosialisasikan.', 'blockers' => null, 'decision' => null, 'resolved' => false],
                ],
                'risks' => [],
                'directions' => [],
            ],
        ];
    }
}
