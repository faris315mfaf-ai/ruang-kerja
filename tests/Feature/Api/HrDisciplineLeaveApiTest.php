<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceAdjustment;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;
use Tests\Support\RequestScenario;

/*
| API v1 — B5-B Absensi › Kedisiplinan (AttendanceScopeResolver +
| AttendanceDisciplineReport web) dan Admin › Saldo cuti (LeaveBalancePolicy,
| AdjustLeaveBalance web). Rabu 7 Okt 2026 10.00 WIB.
*/

describe('kedisiplinan', function () {
    beforeEach(function () {
        $this->seed(RoleSeeder::class);
        F::reset();
        $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
        $this->org = $org = F::org();
        $shift = Shift::factory()->create(['name' => 'Reguler']);

        F::day($org['rizky'], '2026-10-01', AttendanceStatus::Late, ['shift_id' => $shift->id, 'late_minutes' => 10]);
        F::day($org['rizky'], '2026-10-02', AttendanceStatus::Late, ['shift_id' => $shift->id, 'late_minutes' => 20]);
        F::day($org['rizky'], '2026-10-05', AttendanceStatus::Present, ['shift_id' => $shift->id]);
        F::day($org['sari'], '2026-10-01', AttendanceStatus::Absent, ['shift_id' => $shift->id]);
        F::day($org['sari'], '2026-10-02', AttendanceStatus::Present, ['shift_id' => $shift->id]);
        F::day($org['budi'], '2026-10-01', AttendanceStatus::Present, ['shift_id' => $shift->id]);
        F::day($org['budi'], '2026-10-02', AttendanceStatus::Present, ['shift_id' => $shift->id]);

        $ws = Workspace::factory()->internal()->create(['company_id' => $org['hr']->company_id]);
        F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-10-05', 'created_at' => '2026-10-02 09:00', 'completed_at' => '2026-10-04 09:00']);
        F::task($ws, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-06']);
    });

    it('returns the web discipline report for HR, side by side without a combined score', function () {
        Sanctum::actingAs($this->org['hr']);

        $response = $this->getJson('/api/v1/absensi/tim/kedisiplinan')
            ->assertOk()
            ->assertJsonPath('report.kpis.attendance_discipline.value', 57)
            ->assertJsonPath('report.kpis.attendance_discipline.numerator', 4)
            ->assertJsonPath('report.kpis.late_days.value', 2)
            ->assertJsonPath('report.kpis.completion_rate.value', 50)
            ->assertJsonPath('report.kpis.lead_time.value', 2)
            ->assertJsonCount(8, 'report.trend')
            ->assertJsonPath('web_path', '/absensi/kedisiplinan');

        expect($response->json('definitions'))->not->toBeEmpty()
            ->and($response->json('filters.presets'))->not->toBeEmpty()
            ->and($response->json('report.kpis'))->not->toHaveKey('score')
            ->and(collect($response->json('report.people'))->pluck('user.name')->take(2)->all())->toBe(['Sari Wulandari', 'Rizky Aditya']);

        $this->getJson('/api/v1/absensi/tim/kedisiplinan?periode=minggu')->assertOk()
            ->assertJsonPath('report.kpis.attendance_discipline.numerator', 1)
            ->assertJsonPath('report.kpis.attendance_discipline.denominator', 1);
    });

    it('limits a Kepala Divisi to the own division and refuses other divisions', function () {
        Sanctum::actingAs($this->org['kadiv']);

        $people = collect($this->getJson('/api/v1/absensi/tim/kedisiplinan')->assertOk()->assertJsonPath('scope.member_count', 3)->json('report.people'))
            ->pluck('user.name')->sort()->values()->all();
        expect($people)->toBe(['Dimas Pratama', 'Rizky Aditya', 'Sari Wulandari']);

        $this->getJson('/api/v1/absensi/tim/kedisiplinan?divisi='.$this->org['keu']->id)->assertForbidden();
    });

    it('opens for Direksi and refuses staff', function () {
        Sanctum::actingAs($this->org['direksi']);
        $this->getJson('/api/v1/absensi/tim/kedisiplinan')->assertOk();

        Sanctum::actingAs($this->org['rizky']);
        $this->getJson('/api/v1/absensi/tim/kedisiplinan')->assertForbidden();
    });
});

describe('saldo cuti', function () {
    beforeEach(function () {
        $this->seed(RoleSeeder::class);
        Notification::fake();
        $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
        $this->s = RequestScenario::make();
        $this->s->employee->update(['joined_at' => '2026-07-01']);
        $this->balance = LeaveBalance::factory()->create([
            'user_id' => $this->s->employee->id, 'leave_type_id' => $this->s->annual->id, 'year' => 2026,
            'entitled_days' => 6, 'used_days' => 1, 'pending_days' => 1,
        ]);
    });

    it('lists balances per employee for the type and year, with prorated joiners and adjust rights', function () {
        Sanctum::actingAs($this->s->hr);

        $response = $this->getJson('/api/v1/admin/saldo-cuti?tahun=2026&jenis='.$this->s->annual->id)
            ->assertOk()
            ->assertJsonPath('year', 2026)
            ->assertJsonPath('type.code', 'CUT')
            ->assertJsonPath('years', [2024, 2025, 2026, 2027])
            ->assertJsonPath('web_path', '/admin/saldo-cuti');

        $row = collect($response->json('rows'))->firstWhere('user.name', 'Rizky Aditya');
        expect($row['balance'])->toMatchArray(['id' => $this->balance->id, 'entitled' => 6, 'used' => 1, 'pending' => 1, 'available' => 4])
            ->and($row['prorated'])->toBeTrue()
            ->and($row['can']['adjust'])->toBeTrue()
            ->and(collect($response->json('rows'))->firstWhere('user.name', 'Hana Pratiwi')['balance'])->toBeNull();

        $this->getJson('/api/v1/admin/saldo-cuti?cari=rizky')->assertOk()->assertJsonCount(1, 'rows');
    });

    it('records an adjustment with reason, actor and audit, and returns the history', function () {
        Sanctum::actingAs($this->s->hr);

        $this->postJson("/api/v1/admin/saldo-cuti/{$this->balance->id}/penyesuaian", ['delta_days' => 1.5, 'reason' => 'Kompensasi lembur hari libur'])
            ->assertOk()
            ->assertJsonPath('message', 'Penyesuaian saldo Rizky Aditya dicatat.')
            ->assertJsonPath('balance.adjustments', 1.5)
            ->assertJsonPath('balance.available', 5.5)
            ->assertJsonPath('items.0.reason', 'Kompensasi lembur hari libur')
            ->assertJsonPath('items.0.actor', 'Hana Pratiwi');

        expect(LeaveBalanceAdjustment::query()->sole()->actor_id)->toBe($this->s->hr->id);
        $audit = AuditLog::query()->where('action', 'leave_balance.adjusted')->sole();
        expect($audit->user_id)->toBe($this->s->hr->id)->and($audit->new_values)->toMatchArray(['delta_days' => 1.5, 'reason' => 'Kompensasi lembur hari libur']);

        $this->getJson("/api/v1/admin/saldo-cuti/{$this->balance->id}/riwayat")
            ->assertOk()
            ->assertJsonPath('balance.id', $this->balance->id)
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.delta_days', 1.5);
    });

    it('requires a reason and never lets the balance go negative', function () {
        Sanctum::actingAs($this->s->hr);

        $this->postJson("/api/v1/admin/saldo-cuti/{$this->balance->id}/penyesuaian", ['delta_days' => 1, 'reason' => ''])
            ->assertUnprocessable()->assertJsonPath('errors.reason.0', 'Alasan penyesuaian wajib diisi.');
        $this->postJson("/api/v1/admin/saldo-cuti/{$this->balance->id}/penyesuaian", ['delta_days' => 0.3, 'reason' => 'Coba'])
            ->assertUnprocessable()->assertJsonValidationErrors('delta_days');
        $this->postJson("/api/v1/admin/saldo-cuti/{$this->balance->id}/penyesuaian", ['delta_days' => -10, 'reason' => 'Koreksi'])
            ->assertUnprocessable()->assertJsonPath('errors.delta_days.0', 'Saldo tidak boleh minus: sisa yang bisa dikurangi 4 hari.');

        expect(LeaveBalanceAdjustment::query()->count())->toBe(0);
    });

    it('is HR / Super Admin only: Direksi, Kepala Divisi and staff are refused; other companies are hidden', function () {
        foreach ([$this->s->direksi, $this->s->manager, $this->s->employee] as $actor) {
            Sanctum::actingAs($actor);
            $this->getJson('/api/v1/admin/saldo-cuti')->assertForbidden();
            $this->getJson("/api/v1/admin/saldo-cuti/{$this->balance->id}/riwayat")->assertForbidden();
            $this->postJson("/api/v1/admin/saldo-cuti/{$this->balance->id}/penyesuaian", ['delta_days' => 1, 'reason' => 'Bonus'])->assertForbidden();
        }

        $foreign = LeaveBalance::factory()->create([
            'user_id' => User::factory()->forCompany(Company::factory()->create())->create()->id,
            'leave_type_id' => $this->s->annual->id, 'year' => 2026,
        ]);
        Sanctum::actingAs($this->s->hr);
        $this->getJson("/api/v1/admin/saldo-cuti/{$foreign->id}/riwayat")->assertNotFound();
        $this->postJson("/api/v1/admin/saldo-cuti/{$foreign->id}/penyesuaian", ['delta_days' => 1, 'reason' => 'Bonus'])->assertForbidden();

        $admin = User::factory()->withTwoFactor()->withRole(Role::SuperAdmin)->create();
        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/saldo-cuti')->assertOk();

        expect(LeaveBalanceAdjustment::query()->count())->toBe(0);
    });
});
