<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\AdjustLeaveBalance;
use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\LeaveEntitlement;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\AuditLog;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceAdjustment;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Support\SessionKey;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    $this->s->employee->update(['joined_at' => '2020-03-01']);
});

/**
 * @param  list<list<string>>  $rows
 */
function balanceCsv(array $rows, string $name = 'saldo.csv'): UploadedFile
{
    $lines = array_map(fn (array $row): string => implode(',', $row), $rows);

    return UploadedFile::fake()->createWithContent($name, implode("\n", $lines)."\n");
}

/**
 * @return array<string, mixed>
 */
function importReport(TestResponse $response): array
{
    $flash = $response->baseResponse instanceof RedirectResponse
        ? session()->get(SessionKey::FLASH_DATA, [])
        : [];

    return $flash['balanceImport'] ?? [];
}

describe('proration for mid-year joiners', function () {
    it('counts the remaining months and rounds down to half a day', function (string $joined, float $quota, float $expected) {
        $type = new LeaveType(['annual_quota_days' => $quota]);
        $user = new User(['joined_at' => $joined]);

        expect(app(LeaveEntitlement::class)->forYear($user, $type, 2026))->toBe($expected);
    })->with([
        'joined in an earlier year' => ['2025-11-20', 12, 12.0],
        'joined 10 Jan (January counts)' => ['2026-01-10', 12, 12.0],
        'joined 20 Jan (January does not count)' => ['2026-01-20', 12, 11.0],
        'joined 1 Jul → 6 months' => ['2026-07-01', 12, 6.0],
        'joined 20 Jul → 5 months' => ['2026-07-20', 12, 5.0],
        'joined 10 Mar → 10 months' => ['2026-03-10', 12, 10.0],
        '15 × 7/12 = 8.75 → 8.5' => ['2026-06-05', 15, 8.5],
        '22 × 5/12 = 9.17 → 9' => ['2026-08-01', 22, 9.0],
        'joined 20 Dec → 0' => ['2026-12-20', 12, 0.0],
        'joined next year → 0' => ['2027-01-04', 12, 0.0],
    ]);

    it('gives the full quota when the join date is unknown', function () {
        expect(app(LeaveEntitlement::class)->forYear(new User, new LeaveType(['annual_quota_days' => 12]), 2026))->toBe(12.0);
    });

    it('prorates in the yearly generator and when a balance is created on first use', function () {
        $s = $this->s;
        $newcomer = User::factory()->withRole(Role::Anggota)->managedBy($s->manager)->create(['joined_at' => '2026-07-01']);

        app(GenerateAnnualBalances::class)->handle(2026);

        $balance = LeaveBalance::query()->where(['user_id' => $newcomer->id, 'leave_type_id' => $s->annual->id, 'year' => 2026])->sole();
        expect($balance->entitled_days)->toBe(6.0)
            ->and(LeaveBalance::query()->where(['user_id' => $s->employee->id, 'year' => 2026, 'leave_type_id' => $s->annual->id])->value('entitled_days'))->toEqual(12);

        $late = User::factory()->withRole(Role::Anggota)->managedBy($s->manager)->create(['joined_at' => '2026-09-20']);
        $ledger = app(BalanceLedger::class);

        expect($ledger->peek($late, $s->annual, 2026)?->entitled_days)->toBe(3.0)
            ->and($ledger->balanceFor($late, $s->annual, 2026)?->entitled_days)->toBe(3.0)
            // Next year: full quota.
            ->and($ledger->peek($late, $s->annual, 2027)?->entitled_days)->toBe(12.0);
    });

    it('flags prorated rows on the admin page', function () {
        $s = $this->s;
        User::factory()->withRole(Role::Anggota)->create(['name' => 'Aaron Baru', 'joined_at' => '2026-07-01']);

        $this->actingAs($s->hr)->get('/admin/saldo-cuti?tahun=2026')
            ->assertInertia(fn (Assert $page) => $page
                ->where('rows.0.user.name', 'Aaron Baru')
                ->where('rows.0.prorated', true)
                ->where('rows.0.joined_at', '2026-07-01')
                ->where('proration.example_july', 6)
                ->has('import.columns', 8)
                ->missing('history'));
    });
});

describe('opening balance and adjustments', function () {
    it('counts opening and adjustments in the available balance', function () {
        $balance = LeaveBalance::factory()->create([
            'entitled_days' => 12, 'carried_over_days' => 2, 'opening_days' => 3, 'used_days' => 4, 'pending_days' => 1,
        ]);
        $balance->adjustment_days = -1.5;

        expect($balance->total())->toBe(15.5)
            ->and($balance->available())->toBe(10.5)
            ->and($balance->remaining())->toBe(11.5)
            ->and($balance->toSummary())->toMatchArray(['opening' => 3.0, 'adjustments' => -1.5, 'available' => 10.5]);
    });

    it('lets HR set the opening balance (audited) and keeps it when omitted', function () {
        $s = $this->s;
        $balance = LeaveBalance::factory()->create(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026, 'entitled_days' => 12]);

        $this->actingAs($s->hr)->put("/admin/saldo-cuti/{$balance->id}", ['entitled_days' => 12, 'carried_over_days' => 0, 'opening_days' => 4.5])
            ->assertSessionHasNoErrors();
        expect($balance->refresh()->opening_days)->toBe(4.5)->and($balance->available())->toBe(16.5);

        $audit = AuditLog::query()->where('action', 'leave_balance.updated')->latest('id')->firstOrFail();
        expect($audit->new_values)->toMatchArray(['opening_days' => 4.5]);

        // Older clients send only entitlement + carry-over: the opening balance stays.
        $this->actingAs($s->hr)->put("/admin/saldo-cuti/{$balance->id}", ['entitled_days' => 10, 'carried_over_days' => 0])
            ->assertSessionHasNoErrors();
        expect($balance->refresh()->opening_days)->toBe(4.5)->and($balance->entitled_days)->toBe(10.0);
    });

    it('records an adjustment with its reason, actor and audit row', function () {
        $s = $this->s;
        $balance = LeaveBalance::factory()->create(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026, 'entitled_days' => 12]);

        $this->actingAs($s->hr)->post("/admin/saldo-cuti/{$balance->id}/penyesuaian", ['delta_days' => 2, 'reason' => 'Kompensasi lembur hari libur'])
            ->assertSessionHasNoErrors()
            ->assertInertiaFlash('toast.type', 'success');

        $adjustment = LeaveBalanceAdjustment::query()->sole();
        expect($adjustment->delta_days)->toBe(2.0)
            ->and($adjustment->reason)->toBe('Kompensasi lembur hari libur')
            ->and($adjustment->actor_id)->toBe($s->hr->id)
            ->and($balance->refresh()->adjustment_days)->toBe(2.0)
            ->and($balance->available())->toBe(14.0);

        $audit = AuditLog::query()->where('action', 'leave_balance.adjusted')->sole();
        expect($audit->user_id)->toBe($s->hr->id)
            ->and($audit->new_values)->toMatchArray(['adjustment_days' => 2, 'delta_days' => 2, 'reason' => 'Kompensasi lembur hari libur', 'adjustment_id' => $adjustment->id]);

        $this->actingAs($s->hr)->post("/admin/saldo-cuti/{$balance->id}/penyesuaian", ['delta_days' => -1, 'reason' => 'Koreksi input'])
            ->assertSessionHasNoErrors();
        expect($balance->refresh()->adjustment_days)->toBe(1.0)
            ->and((float) $balance->adjustments()->sum('delta_days'))->toBe(1.0);

        // History on demand.
        $this->actingAs($s->hr)->get("/admin/saldo-cuti?tahun=2026&riwayat={$balance->id}", [
            'X-Inertia' => 'true', 'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
            'X-Inertia-Partial-Component' => 'admin/leave-balances', 'X-Inertia-Partial-Data' => 'history',
        ])->assertJsonPath('props.history.balance_id', $balance->id)
            ->assertJsonPath('props.history.items.0.delta_days', -1)
            ->assertJsonPath('props.history.items.1.reason', 'Kompensasi lembur hari libur')
            ->assertJsonPath('props.history.items.1.actor', 'Hana Pratiwi');
    });

    it('requires a reason and never lets an adjustment make the balance negative', function () {
        $s = $this->s;
        $balance = LeaveBalance::factory()->create(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026, 'entitled_days' => 3, 'used_days' => 1, 'pending_days' => 1]);

        $this->actingAs($s->hr)->post("/admin/saldo-cuti/{$balance->id}/penyesuaian", ['delta_days' => 1, 'reason' => ''])
            ->assertSessionHasErrors(['reason' => 'Alasan penyesuaian wajib diisi.']);
        $this->actingAs($s->hr)->post("/admin/saldo-cuti/{$balance->id}/penyesuaian", ['delta_days' => 0, 'reason' => 'x'])
            ->assertSessionHasErrors(['delta_days' => 'Penyesuaian tidak boleh 0.']);
        $this->actingAs($s->hr)->post("/admin/saldo-cuti/{$balance->id}/penyesuaian", ['delta_days' => -1.5, 'reason' => 'Terlalu banyak'])
            ->assertSessionHasErrors(['delta_days' => 'Saldo tidak boleh minus: sisa yang bisa dikurangi 1 hari.']);

        expect(fn () => app(AdjustLeaveBalance::class)->handle($s->hr, $balance, 0.3, 'x'))->toThrow(ValidationException::class);

        app(AdjustLeaveBalance::class)->handle($s->hr, $balance, -1, 'Ambil kembali');
        expect($balance->refresh()->available())->toBe(0.0)
            ->and(LeaveBalanceAdjustment::query()->count())->toBe(1);

        // The database refuses a negative total even when bypassing the action.
        expect(fn () => DB::table('leave_balances')->where('id', $balance->id)->update(['adjustment_days' => -2]))
            ->toThrow(QueryException::class);
        expect(fn () => DB::table('leave_balances')->where('id', $balance->id)->update(['opening_days' => -1, 'entitled_days' => 10]))
            ->toThrow(QueryException::class);
        expect(fn () => DB::table('leave_balance_adjustments')->insert(['id' => (string) str()->ulid(), 'balance_id' => $balance->id, 'delta_days' => 0, 'reason' => 'x']))
            ->toThrow(QueryException::class);
    });

    it('lets only HR / Super Admin adjust balances', function (Role $role, bool $allowed) {
        $s = $this->s;
        $balance = LeaveBalance::factory()->create(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026, 'entitled_days' => 12]);
        $actor = User::factory()->withRole($role)->create();

        $response = $this->actingAs($actor)->post("/admin/saldo-cuti/{$balance->id}/penyesuaian", ['delta_days' => 1, 'reason' => 'Bonus']);

        $allowed ? $response->assertSessionHasNoErrors()->assertRedirect() : $response->assertForbidden();
        expect(LeaveBalanceAdjustment::query()->count())->toBe($allowed ? 1 : 0);
    })->with([
        'super_admin' => [Role::SuperAdmin, true],
        'hr' => [Role::Hr, true],
        'direksi' => [Role::Direksi, false],
        'kepala_divisi' => [Role::KepalaDivisi, false],
        'anggota' => [Role::Anggota, false],
    ]);

    it('carries opening and adjusted days over to the next year', function () {
        $s = $this->s;
        $s->annual->update(['carry_over_max_days' => 10]);
        $balance = LeaveBalance::factory()->create(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026, 'entitled_days' => 12, 'opening_days' => 2, 'used_days' => 10]);
        app(AdjustLeaveBalance::class)->handle($s->hr, $balance, 1, 'Bonus');

        app(GenerateAnnualBalances::class)->handle(2027);

        expect(LeaveBalance::query()->where(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2027])->value('carried_over_days'))->toEqual(5);
    });
});

describe('import', function () {
    it('downloads the template as CSV and XLSX', function (string $format) {
        $response = $this->actingAs($this->s->hr)->get("/admin/saldo-cuti/impor/templat/{$format}");

        $response->assertOk()->assertDownload("templat-impor-saldo-cuti.{$format}");
    })->with(['csv', 'xlsx']);

    it('previews with per-row errors without writing anything', function () {
        $s = $this->s;
        LeaveBalance::factory()->create(['user_id' => $s->manager->id, 'leave_type_id' => $s->annual->id, 'year' => 2026, 'entitled_days' => 12, 'used_days' => 11]);

        $file = balanceCsv([
            ['email', 'jenis', 'tahun', 'saldo_awal', 'jatah', 'bawaan', 'penyesuaian', 'alasan'],
            [$s->employee->email, 'cut', '2026', '4', '', '', '', ''],
            [$s->employee->email, 'CUT', '2026', '', '', '', '1', ''],
            ['tidak.ada@contoh.test', 'CUT', '2026', '1', '', '', '', ''],
            [$s->hr->email, 'SKT', '2026', '1', '', '', '', ''],
            [$s->hr->email, 'CUT', '26', '1', '', '', '', ''],
            [$s->hr->email, 'CUT', '2026', '1.3', '', '', '', ''],
            [$s->manager->email, 'CUT', '2026', '', '', '', '-2', 'Koreksi'],
            [$s->direksi->email, 'CUT', '2026', '', '', '', '', ''],
            [$s->direksi->email, 'CUT', '2026', '', '13', '1.5', '', ''],
        ]);

        $response = $this->actingAs($s->hr)->post('/admin/saldo-cuti/impor', ['file' => $file, 'mode' => 'preview'])
            ->assertRedirect()
            ->assertSessionHasNoErrors()
            ->assertInertiaFlashMissing('toast');

        $report = importReport($response);
        $errors = collect($report['rows'])->mapWithKeys(fn (array $row): array => [$row['row'] => $row['errors']]);

        expect($report['mode'])->toBe('preview')
            ->and($report['summary'])->toBe(['total' => 9, 'ok' => 1, 'error' => 8, 'applied' => 0])
            ->and($errors[2])->toBe([])
            ->and($errors[3])->toBe(['Alasan wajib diisi untuk penyesuaian.', 'Baris ganda: karyawan, jenis, dan tahun yang sama sudah ada di baris 2.'])
            ->and($errors[4])->toBe(['Karyawan aktif dengan email ini tidak ditemukan.'])
            ->and($errors[5])->toBe(['Jenis SKT tidak dikenal atau tidak memakai saldo tahunan.'])
            ->and($errors[6])->toBe(['Tahun wajib diisi (4 angka, mis. 2026).'])
            ->and($errors[7])->toBe(['Saldo awal harus kelipatan 0,5 hari.'])
            ->and($errors[8])->toBe(['Saldo menjadi minus (-1 hari): sudah terpakai/diajukan 11 hari.'])
            ->and($errors[9])->toBe(['Isi minimal satu dari saldo_awal, jatah, bawaan, atau penyesuaian.'])
            ->and($errors[10])->toBe(['Baris ganda: karyawan, jenis, dan tahun yang sama sudah ada di baris 9.']);

        $first = collect($report['rows'])->firstWhere('row', 2);
        expect($first)->toMatchArray(['name' => 'Rizky Aditya', 'type_code' => 'CUT', 'year' => 2026, 'opening' => 4.0, 'available_before' => 12.0, 'available_after' => 16.0])
            ->and($first)->not->toHaveKeys(['user', 'type']);

        expect(LeaveBalance::query()->where('user_id', $s->employee->id)->exists())->toBeFalse()
            ->and(LeaveBalanceAdjustment::query()->exists())->toBeFalse()
            ->and(AuditLog::query()->where('action', 'like', 'leave_balance.%')->exists())->toBeFalse();
    });

    it('applies the valid rows on commit and skips the invalid ones', function () {
        $s = $this->s;
        $s->manager->update(['joined_at' => '2026-07-01']);

        $file = fn () => balanceCsv([
            ['Email', 'Jenis', 'Tahun', 'Saldo awal', 'Jatah', 'Bawaan', 'Penyesuaian', 'Alasan'],
            [$s->employee->email, 'CUT', '2026', '4', '', '2', '', ''],
            [$s->manager->email, 'CUT', '2026', '', '', '', '1.5', 'Kompensasi'],
            ['tidak.ada@contoh.test', 'CUT', '2026', '1', '', '', '', ''],
        ]);

        $response = $this->actingAs($s->hr)->post('/admin/saldo-cuti/impor', ['file' => $file(), 'mode' => 'commit'])
            ->assertInertiaFlash('toast.type', 'warning')
            ->assertInertiaFlash('toast.message', 'Impor saldo: 2 baris diterapkan, 1 dilewati.');

        expect(importReport($response)['summary'])->toBe(['total' => 3, 'ok' => 2, 'error' => 1, 'applied' => 2]);

        $rizky = LeaveBalance::query()->where(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026])->sole();
        expect($rizky->entitled_days)->toBe(12.0)
            ->and($rizky->opening_days)->toBe(4.0)
            ->and($rizky->carried_over_days)->toBe(2.0)
            ->and($rizky->generated_at)->not->toBeNull();

        // New balance created prorated (joined 1 Jul → 6), then adjusted.
        $dimas = LeaveBalance::query()->where(['user_id' => $s->manager->id, 'leave_type_id' => $s->annual->id, 'year' => 2026])->sole();
        expect($dimas->entitled_days)->toBe(6.0)
            ->and($dimas->adjustment_days)->toBe(1.5)
            ->and($dimas->available())->toBe(7.5)
            ->and($dimas->adjustments()->sole()->reason)->toBe('Kompensasi');

        expect(AuditLog::query()->where('action', 'leave_balance.updated')->count())->toBe(1)
            ->and(AuditLog::query()->where('action', 'leave_balance.adjusted')->count())->toBe(1);
    });

    it('reads XLSX and reports missing required columns', function () {
        $s = $this->s;
        $path = tempnam(sys_get_temp_dir(), 'saldo').'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([['email', 'jenis', 'tahun', 'saldo_awal'], [$s->employee->email, 'CUT', '2026', '3']]);
        (new Xlsx($sheet))->save($path);
        $xlsx = new UploadedFile($path, 'saldo.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $report = importReport($this->actingAs($s->hr)->post('/admin/saldo-cuti/impor', ['file' => $xlsx, 'mode' => 'preview']));
        expect($report['summary']['ok'])->toBe(1)
            ->and($report['rows'][0]['available_after'])->toBe(15.0);

        $report = importReport($this->actingAs($s->hr)->post('/admin/saldo-cuti/impor', [
            'file' => balanceCsv([['nama', 'jenis'], ['Rizky', 'CUT']]), 'mode' => 'commit',
        ]));
        expect($report['missing_columns'])->toBe(['email', 'tahun'])
            ->and($report['rows'])->toBe([]);

        $this->actingAs($s->hr)->post('/admin/saldo-cuti/impor', ['file' => UploadedFile::fake()->create('saldo.pdf', 10, 'application/pdf'), 'mode' => 'preview'])
            ->assertSessionHasErrors(['file' => 'Berkas impor harus berformat CSV atau XLSX.']);

        $this->actingAs($s->employee)->post('/admin/saldo-cuti/impor', ['file' => balanceCsv([['email']]), 'mode' => 'preview'])
            ->assertForbidden();
        $this->actingAs($s->employee)->get('/admin/saldo-cuti/impor/templat/csv')->assertForbidden();
    });
});
