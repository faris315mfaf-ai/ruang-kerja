<?php

use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Analytics\Exports\DashboardSheet;
use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\EmployeeProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Facades\Excel;
use Tests\Support\RequestScenario;

/*
 * Privasi › Data Saya (Sprint 10): a person sees and exports ONLY their own
 * data; NIK is masked everywhere; exports are audited.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    $s = $this->s;

    EmployeeProfile::factory()->for($s->employee)->create(['nik' => '3201234567890123', 'employee_number' => 'EMP-00042']);
    EmployeeProfile::factory()->for($s->manager)->create(['nik' => '3209999999990999']);

    // Employee: 2 days (one with a log), a request decided by the manager.
    $day = AttendanceDay::factory()->for($s->employee)->on('2026-10-01')->status(AttendanceStatus::Present)->create(['check_in_at' => CarbonImmutable::parse('2026-10-01 07:55', 'Asia/Jakarta')->utc()]);
    AttendanceDay::factory()->for($s->employee)->on('2026-10-02')->status(AttendanceStatus::Late)->create(['late_minutes' => 12]);
    AttendanceLog::factory()->forDay($day)->create(['latitude' => -6.2001234, 'longitude' => 106.8166789, 'ip_address' => '10.0.0.7', 'selfie_path' => 'selfies/a.jpg']);
    // Manager: 1 day of their own.
    AttendanceDay::factory()->for($s->manager)->on('2026-10-01')->status(AttendanceStatus::Wfh)->create();

    $this->request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13', 'reason' => 'Acara keluarga']);
    $s->approve($s->manager, $this->request, 'Selamat berlibur');
    app(GiveAttendanceConsent::class)->handle($s->employee);
});

it('shows the employee only their own profile, consent, attendance, requests and decisions', function () {
    $s = $this->s;

    $response = $this->actingAs($s->employee)->get('/privasi')->assertOk();

    $response->assertInertia(fn (Assert $page) => $page
        ->component('privacy/index')
        ->where('profile.name', $s->employee->name)
        ->where('profile.employee_number', 'EMP-00042')
        ->where('profile.nik_masked', '••••••••••••0123')
        ->where('consent.granted', true)
        ->where('consent.version', '1.0')
        ->where('consent.policy_version', '1.0')
        ->has('consent.history', 2)
        ->where('policy.version', '1.0')
        ->missing('attendance')
        ->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('attendance.total_days', 2)
            ->where('attendance.counts', ['late' => 1, 'present' => 1])
            ->where('attendance.logs', 1)
            ->where('attendance.selfies', 1)
            ->where('attendance.days.0.date', '2026-10-02')
            ->where('requests.count', 1)
            ->where('requests.items.0.id', $this->request->id)
            ->where('requests.items.0.url', '/pengajuan/'.$this->request->id)
            ->where('decisions.count', 0)));

    // The raw NIK never reaches the browser.
    expect($response->getContent())->not->toContain('3201234567890123');
});

it('shows the approver their decisions, not the requester\'s data', function () {
    $this->actingAs($this->s->manager)->get('/privasi')->assertInertia(fn (Assert $page) => $page
        ->where('profile.name', $this->s->manager->name)
        ->where('profile.nik_masked', '••••••••••••0999')
        ->where('consent.granted', false)
        ->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('attendance.total_days', 1)
            ->where('attendance.counts', ['wfh' => 1])
            ->where('requests.count', 0)
            ->where('decisions.count', 1)
            ->where('decisions.items.0.request_id', $this->request->id)
            ->where('decisions.items.0.requester', $this->s->employee->name)
            ->where('decisions.items.0.decision', 'approved')
            ->where('decisions.items.0.note', 'Selamat berlibur')));
});

it('asks for renewed consent after the policy version changes', function () {
    config(['attendance.consent.version' => '2.0', 'privacy.policy.version' => '2.0']);

    $this->actingAs($this->s->employee)->get('/privasi')->assertInertia(fn (Assert $page) => $page
        ->where('consent.granted', false)
        ->where('consent.needs_renewal', true)
        ->where('consent.granted_version', '1.0')
        ->where('consent.version', '2.0'));
});

it('requires a signed-in active employee', function () {
    $this->get('/privasi')->assertRedirect('/login');
    $this->get('/privasi/ekspor/xlsx')->assertRedirect('/login');

    $inactive = User::factory()->create(['status' => UserStatus::Inactive]);
    $this->actingAs($inactive)->get('/privasi')->assertRedirect();
    $this->actingAs($inactive)->get('/privasi/ekspor/pdf')->assertRedirect();
});

it('exports all of my data to Excel, one sheet per kind, without anyone else\'s rows', function () {
    Excel::fake();
    $s = $this->s;

    $this->actingAs($s->employee)->get('/privasi/ekspor/xlsx')->assertOk();

    Excel::assertDownloaded('data-saya-'.str($s->employee->name)->slug().'-20261005.xlsx', function (DashboardExport $export) use ($s): bool {
        $sheets = collect($export->sheets())->keyBy(fn (DashboardSheet $sheet): string => $sheet->title());
        $profile = collect($sheets['Profil']->array())->pluck(1, 0);
        $logs = $sheets['Log absensi']->array();

        expect($sheets->keys()->all())->toBe(['Profil', 'Persetujuan data', 'Absensi harian', 'Log absensi', 'Pengajuan saya', 'Keputusan saya'])
            ->and($profile['Nama'])->toBe($s->employee->name)
            ->and($profile['NIK (tersamar)'])->toBe('••••••••••••0123')
            ->and(json_encode($export->sheets()[0]->array()))->not->toContain('3201234567890123')
            ->and($sheets['Absensi harian']->array())->toHaveCount(2)
            ->and($logs)->toHaveCount(1)
            ->and($logs[0][4])->toBe(-6.200123)
            ->and($logs[0][8])->toBe('Tersimpan')
            ->and($logs[0][10])->toBe('10.0.0.7')
            ->and($sheets['Pengajuan saya']->array())->toHaveCount(1)
            ->and($sheets['Pengajuan saya']->array()[0][0])->toBe($this->request->number)
            ->and($sheets['Keputusan saya']->array())->toHaveCount(0)
            // Two consent rows (location, selfie) + the current status line.
            ->and($sheets['Persetujuan data']->array())->toHaveCount(3);

        return true;
    });

    $audit = AuditLog::query()->where('action', 'privacy.data_exported')->sole();
    expect($audit->user_id)->toBe($s->employee->id)
        ->and($audit->new_values)->toMatchArray(['format' => 'xlsx'])
        ->and($audit->new_values['rows'] ?? null)->toMatchArray(['Absensi harian' => 2, 'Log absensi' => 1, 'Pengajuan saya' => 1]);
});

it('exports my data as a PDF', function () {
    $response = $this->actingAs($this->s->manager)->get('/privasi/ekspor/pdf')->assertOk();

    expect($response->headers->get('content-type'))->toBe('application/pdf')
        ->and($response->headers->get('content-disposition'))->toContain('data-saya-')
        ->and(AuditLog::query()->where('action', 'privacy.data_exported')->sole()->user_id)->toBe($this->s->manager->id);
});

it('only accepts xlsx or pdf', function () {
    $this->actingAs($this->s->employee)->get('/privasi/ekspor/csv')->assertNotFound();
});
