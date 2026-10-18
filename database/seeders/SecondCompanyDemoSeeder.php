<?php

namespace Database\Seeders;

use App\Domain\Announcements\Enums\AnnouncementAudience;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Organization\Demo\DemoAccount;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\Theme;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Actions\SyncDivisionMembers;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceMembership;
use App\Events\Tasks\TaskAssigneesAdded;
use App\Events\Tasks\TaskCreated;
use App\Events\Workspaces\WorkspaceCreated;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Announcement;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use RuntimeException;

/**
 * Second demo company (Fase 1 multi-perusahaan, manual isolation checks):
 * "PT Contoh Mitra" (contoh.test, Asia/Makassar = WITA) with its own
 * divisions, employees, schedule and attendance history, workspaces with
 * tasks, pending requests, an announcement and meetings.
 *
 *   php artisan db:seed --class=SecondCompanyDemoSeeder
 *
 * Not part of DatabaseSeeder. Local/testing only; the demo accounts
 * admin@contoh.test, hr@contoh.test and anggota@contoh.test get the password
 * `password` only with APP_ENV=local (DemoAccounts::partner(), also on the
 * login page). Idempotent: rows are keyed by email, division code, name,
 * workspace key and meeting title; requests only when the member has none.
 */
class SecondCompanyDemoSeeder extends Seeder
{
    public const string GOOGLE_DOMAIN = 'contoh.test';

    public const string NAME = 'PT Contoh Mitra';

    public const string TIMEZONE = 'Asia/Makassar';

    /** Active employees after the AnalyticsDemoSeeder top-up (0 = named staff only). */
    public int $targetEmployees = 24;

    /** Days of attendance history. */
    public int $days = 30;

    /** code => [code, name, is_board] */
    private const array DIVISIONS = [
        'DIR' => ['DIR', 'Direksi', true],
        'LOG' => ['LOG', 'Logistik', false],
        // Same code as a division of the SPKD demo: division codes and workspace keys are unique per company.
        'KEU' => ['KEU', 'Keuangan & Umum', false],
    ];

    /** name => level */
    private const array POSITIONS = [
        'Direktur' => 1,
        'Kepala Divisi Logistik' => 2,
        'Kepala Divisi Keuangan & Umum' => 2,
        'Administrator Sistem' => 4,
        'Staf Logistik' => 5,
        'Staf Keuangan' => 5,
    ];

    /**
     * email => [name, division, position, manager email, role, work mode]
     * (demo accounts keep the name of DemoAccounts::partner()).
     *
     * @var array<string, array{0: string, 1: string|null, 2: string, 3: string|null, 4: Role, 5: WorkMode}>
     */
    private const array EMPLOYEES = [
        'andi.mappaturung@contoh.test' => ['Andi Mappaturung', 'DIR', 'Direktur', null, Role::Direksi, WorkMode::Office],
        'admin@contoh.test' => ['Admin Mitra', null, 'Administrator Sistem', null, Role::SuperAdmin, WorkMode::Office],
        'irwan.syahputra@contoh.test' => ['Irwan Syahputra', 'LOG', 'Kepala Divisi Logistik', 'andi.mappaturung@contoh.test', Role::KepalaDivisi, WorkMode::Office],
        'hr@contoh.test' => ['Nurhayati Lantara', 'KEU', 'Kepala Divisi Keuangan & Umum', 'andi.mappaturung@contoh.test', Role::Hr, WorkMode::Office],
        'anggota@contoh.test' => ['Fadli Rahman', 'LOG', 'Staf Logistik', 'irwan.syahputra@contoh.test', Role::Anggota, WorkMode::Office],
        'ismail.tahir@contoh.test' => ['Ismail Tahir', 'LOG', 'Staf Logistik', 'irwan.syahputra@contoh.test', Role::Anggota, WorkMode::Field],
        'rosmiati.pakki@contoh.test' => ['Rosmiati Pakki', 'LOG', 'Staf Logistik', 'irwan.syahputra@contoh.test', Role::Anggota, WorkMode::Office],
        'haerul.saleh@contoh.test' => ['Haerul Saleh', 'KEU', 'Staf Keuangan', 'hr@contoh.test', Role::Anggota, WorkMode::Hybrid],
    ];

    /** Division heads. */
    private const array HEADS = ['DIR' => 'andi.mappaturung@contoh.test', 'LOG' => 'irwan.syahputra@contoh.test', 'KEU' => 'hr@contoh.test'];

    /** Not bound to a shift. */
    private const array UNSCHEDULED = ['andi.mappaturung@contoh.test', 'admin@contoh.test'];

    /** @var array<string, User> */
    private array $people = [];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return; // Demo data only (as AnalyticsDemoSeeder).
        }

        $this->call(RoleSeeder::class, silent: true);
        $company = $this->company();

        app(CompanyContext::class)->run($company, function () use ($company): void {
            // Event::fakeFor() re-installs the real dispatcher on Eloquent afterwards (see WorkspaceSeeder).
            $modelDispatcher = Model::getEventDispatcher();
            $notifications = Notification::getFacadeRoot();
            Notification::fake();

            try {
                // No broadcasts or Drive jobs while seeding (as WorkspaceSeeder).
                Event::fakeFor(function () use ($company): void {
                    $divisions = $this->organization($company);
                    $this->schedule($company);
                    $this->workspaces($company, $divisions);
                }, [TaskCreated::class, TaskAssigneesAdded::class, WorkspaceCreated::class, WorkspaceMembersChanged::class]);

                $this->requests($company);
                $this->announcement($company);
                $this->meetings($company);
            } finally {
                Notification::swap($notifications);

                if ($modelDispatcher === null) {
                    Model::unsetEventDispatcher();
                } else {
                    Model::setEventDispatcher($modelDispatcher);
                }
            }
        });

        // Volume: extra staff, attendance history and division tasks (in the company's timezone).
        $volume = new AnalyticsDemoSeeder;
        $volume->force = true;
        $volume->company = $company;
        $volume->targetEmployees = max($this->targetEmployees, count(self::EMPLOYEES));
        $volume->days = $this->days;
        $volume->tasksPerWeek = 2;
        $volume->setContainer($this->container)->__invoke();
    }

    private function company(): Company
    {
        $company = Company::query()->firstOrNew(['google_domain' => self::GOOGLE_DOMAIN]);
        $company->fill(['name' => self::NAME, 'timezone' => self::TIMEZONE]);

        if (! $company->exists) {
            $company->settings = [];
        }

        $company->save();

        return $company;
    }

    /**
     * @return array{DIR: Division, LOG: Division, KEU: Division}
     */
    private function organization(Company $company): array
    {
        $divisions = array_map(function (array $spec) use ($company): Division {
            [$code, $name, $isBoard] = $spec;
            $division = Division::withTrashed()->firstOrNew(['company_id' => $company->id, 'code' => $code]);
            $division->forceFill(['name' => $name, 'is_board' => $isBoard, 'deleted_at' => null])->save();

            return $division;
        }, self::DIVISIONS);

        $positions = [];

        foreach (self::POSITIONS as $name => $level) {
            $positions[$name] = Position::query()->updateOrCreate(['company_id' => $company->id, 'name' => $name], ['level' => $level]);
        }

        $demo = array_flip(array_map(fn (DemoAccount $account): string => $account->email, DemoAccounts::partner()));
        $number = 0;

        foreach (self::EMPLOYEES as $email => [$name, $divisionCode, $position, , $role, $workMode]) {
            $number++;
            $user = User::query()->firstOrNew(['email' => $email]);

            if ($user->exists && $user->company_id !== $company->id) {
                throw new RuntimeException("{$email} sudah dipakai perusahaan lain.");
            }

            $user->forceFill([
                'company_id' => $company->id,
                'name' => $name,
                'division_id' => $divisionCode === null ? null : $divisions[$divisionCode]->id,
                'position_id' => $positions[$position]->id,
                'work_mode' => $workMode,
                'status' => UserStatus::Active,
                'theme' => Theme::System,
                'joined_at' => '2023-01-02',
                'email_verified_at' => $user->email_verified_at ?? now(),
                // Demo accounts sign in with `password`, only on a local machine.
                'password' => isset($demo[$email]) && app()->environment('local') ? DemoAccounts::PASSWORD : null,
            ])->save();
            $user->syncRoles([$role->value]);

            EmployeeProfile::query()->updateOrCreate(['user_id' => $user->id], [
                'company_id' => $company->id,
                'employee_number' => sprintf('CM-%04d', $number),
                'phone' => sprintf('+62811%08d', 40_000_000 + $number),
                'address' => "Jl. Contoh Mitra No. {$number}, Makassar",
            ]);

            $this->people[$email] = $user;
        }

        foreach (self::EMPLOYEES as $email => [, , , $manager]) {
            $this->people[$email]->forceFill(['manager_id' => $manager === null ? null : $this->people[$manager]->id])->save();
        }

        foreach (self::HEADS as $code => $email) {
            $divisions[$code]->forceFill(['head_user_id' => $this->people[$email]->id])->save();
        }

        $team = Team::query()->updateOrCreate(
            ['division_id' => $divisions['LOG']->id, 'name' => 'Tim Armada'],
            ['code' => 'ARM', 'lead_user_id' => $this->people['irwan.syahputra@contoh.test']->id],
        );

        foreach (['ismail.tahir@contoh.test', 'rosmiati.pakki@contoh.test'] as $email) {
            $this->people[$email]->forceFill(['team_id' => $team->id])->save();
        }

        return $divisions;
    }

    /** Kantor Makassar and the "Reguler" shift 08.00–17.00 WITA, Monday–Friday. */
    private function schedule(Company $company): void
    {
        $office = OfficeLocation::query()->updateOrCreate(
            ['company_id' => $company->id, 'name' => 'Kantor Makassar'],
            ['address' => 'Jl. Contoh Mitra No. 1, Makassar', 'latitude' => -5.1476651, 'longitude' => 119.4327314, 'radius_m' => 150, 'is_active' => true],
        );
        $shift = Shift::query()->updateOrCreate(['company_id' => $company->id, 'name' => 'Reguler'], [
            'start_time' => '08:00',
            'end_time' => '17:00',
            'break_minutes' => 60,
            'late_tolerance_min' => 10,
            'early_leave_tolerance_min' => 0,
            'check_in_window_before_min' => 120,
            'office_location_id' => $office->id,
        ]);
        $from = CarbonImmutable::now(CurrentCompany::timezone())->subDays($this->days + 7)->toDateString();

        foreach ($this->people as $email => $user) {
            if (in_array($email, self::UNSCHEDULED, true) || ShiftAssignment::query()->where('user_id', $user->id)->exists()) {
                continue;
            }

            ShiftAssignment::query()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'weekdays' => [1, 2, 3, 4, 5], 'valid_from' => $from]);
        }
    }

    /**
     * Division workspaces (LOG, KEU), personal ones and the project
     * "Ekspansi Gudang Parepare" (EGP) with tasks.
     *
     * @param  array<string, Division>  $divisions
     */
    private function workspaces(Company $company, array $divisions): void
    {
        foreach ($divisions as $division) {
            app(SyncDivisionMembers::class)->handle($division);
        }

        foreach ($this->people as $user) {
            app(EnsurePersonalWorkspace::class)->handle($user);
        }

        $kadiv = $this->people['irwan.syahputra@contoh.test'];

        if (Workspace::query()->where('company_id', $company->id)->where('key', 'EGP')->exists()) {
            return;
        }

        $today = CarbonImmutable::now(CurrentCompany::timezone())->startOfDay();
        $project = app(CreateWorkspace::class)->handle($kadiv, [
            'type' => WorkspaceType::Project,
            'name' => 'Ekspansi Gudang Parepare',
            'key' => 'EGP',
            'description' => 'Pembukaan gudang transit kedua di Parepare: lahan, armada, dan perizinan.',
            'visibility' => WorkspaceVisibility::Internal,
        ]);
        $project->forceFill([
            'lead_user_id' => $kadiv->id,
            'sponsor_user_id' => $this->people['andi.mappaturung@contoh.test']->id,
            'division_id' => $divisions['LOG']->id,
            'start_date' => $today->subDays(20)->toDateString(),
            'target_date' => $today->addDays(40)->toDateString(),
            'project_status' => 'active',
        ])->save();

        $membership = app(WorkspaceMembership::class);

        foreach (['anggota@contoh.test', 'ismail.tahir@contoh.test', 'rosmiati.pakki@contoh.test', 'andi.mappaturung@contoh.test'] as $email) {
            $membership->put($project, $this->people[$email]->id, WorkspaceRole::Member);
        }

        $tasks = [
            ['Survei lahan gudang Parepare', 'anggota@contoh.test', -3, TaskPriority::High],
            ['Bandingkan penawaran sewa truk', 'ismail.tahir@contoh.test', 2, TaskPriority::Medium],
            ['Urus izin bongkar muat pelabuhan', 'rosmiati.pakki@contoh.test', 5, TaskPriority::Urgent],
            ['Rancang tata letak rak gudang', 'anggota@contoh.test', 0, TaskPriority::Medium],
            ['Hitung kebutuhan forklift', 'ismail.tahir@contoh.test', 9, TaskPriority::Low],
        ];

        foreach ($tasks as [$title, $assignee, $due, $priority]) {
            app(CreateTask::class)->handle($project, $kadiv, [
                'title' => $title,
                'assignee_ids' => [$this->people[$assignee]->id],
                'due_date' => $today->addDays($due)->toDateString(),
                'priority' => $priority->value,
            ]);
        }
    }

    /** Request types of the company and two pending "Izin" waiting for the Kepala Divisi. */
    private function requests(Company $company): void
    {
        (new RequestSeeder)->setContainer($this->container)->seedCompany($company);
        $member = $this->people['anggota@contoh.test'];

        if (EmployeeRequest::query()->where('user_id', $member->id)->exists()) {
            return;
        }

        $permit = LeaveType::query()->where('company_id', $company->id)->where('code', 'IZN')->firstOrFail();
        $monday = CarbonImmutable::now(CurrentCompany::timezone())->next(CarbonImmutable::MONDAY);

        foreach ([['anggota@contoh.test', 0, 'Mengurus perpanjangan SIM di Samsat Makassar.'], ['ismail.tahir@contoh.test', 2, 'Menghadiri wisuda adik di Parepare.']] as [$email, $offset, $reason]) {
            app(SubmitRequest::class)->handle($this->people[$email], RequestInput::fromArray($permit, [
                'start_date' => $monday->addDays($offset)->toDateString(),
                'end_date' => $monday->addDays($offset)->toDateString(),
                'reason' => $reason,
            ]));
        }
    }

    private function announcement(Company $company): void
    {
        Announcement::query()->firstOrCreate(
            ['company_id' => $company->id, 'title' => 'Selamat datang di RuangKerja PT Contoh Mitra'],
            [
                'author_id' => $this->people['hr@contoh.test']->id,
                'body' => 'Mulai minggu ini absensi, pengajuan, dan tugas tim dicatat di RuangKerja.',
                'audience' => AnnouncementAudience::All,
                'target_ids' => [],
                'published_at' => now(),
            ],
        );
    }

    /** Today 10.00 WITA (video) and a weekly Logistik evaluation (Friday 14.00). */
    private function meetings(Company $company): void
    {
        $today = CarbonImmutable::now(CurrentCompany::timezone())->startOfDay();
        $kadiv = $this->people['irwan.syahputra@contoh.test'];
        $specs = [
            ['Koordinasi armada Makassar–Parepare', $today->setTime(10, 0), 45, MeetingPlatform::Video, Recurrence::None, ['anggota@contoh.test', 'ismail.tahir@contoh.test', 'rosmiati.pakki@contoh.test']],
            ['Evaluasi mingguan Logistik', $today->next(CarbonImmutable::FRIDAY)->setTime(14, 0), 60, MeetingPlatform::Room, Recurrence::Weekly, ['anggota@contoh.test', 'hr@contoh.test', 'andi.mappaturung@contoh.test']],
        ];

        foreach ($specs as [$title, $start, $minutes, $platform, $recurrence, $participants]) {
            if (Meeting::query()->where('company_id', $company->id)->where('title', $title)->exists()) {
                continue;
            }

            $meeting = Meeting::query()->create([
                'company_id' => $company->id,
                'organizer_id' => $kadiv->id,
                'minute_taker_id' => $this->people['anggota@contoh.test']->id,
                'title' => $title,
                'starts_at' => $start->utc(),
                'ends_at' => $start->addMinutes($minutes)->utc(),
                'platform' => $platform,
                'location' => $platform === MeetingPlatform::Room ? 'Ruang rapat lantai 2' : null,
                'agenda' => ['Status pekerjaan', 'Kendala & tindak lanjut'],
                'recurrence' => $recurrence,
                'reminders' => [15, 5],
            ]);
            MeetingParticipant::query()->create(['meeting_id' => $meeting->id, 'user_id' => $kadiv->id, 'rsvp' => Rsvp::Yes, 'responded_at' => now()]);

            foreach ($participants as $email) {
                MeetingParticipant::query()->create(['meeting_id' => $meeting->id, 'user_id' => $this->people[$email]->id, 'rsvp' => Rsvp::Pending]);
            }
        }
    }
}
