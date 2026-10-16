<?php

namespace Database\Seeders;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\ApproveStep;
use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\ApprovalFlow;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Notification;

/**
 * Requests module (Sprint 4): approval flows, leave types, yearly balances and —
 * in local/testing with the demo organization — demo requests in various states.
 * Idempotent: flows/types are upserted by name/code; demo requests are only
 * created when the demo member has none yet.
 */
class RequestSeeder extends Seeder
{
    /**
     * code => [name, category, quota, carry, attachment after, half day, backdate, min service, flow, sort]
     *
     * @var array<string, array{0: string, 1: RequestCategory, 2: float|null, 3: float|null, 4: int|null, 5: bool, 6: int|null, 7: int|null, 8: string, 9: int}>
     */
    private const array TYPES = [
        'CUT' => ['Cuti tahunan', RequestCategory::Leave, 12, 5, null, true, null, null, ApprovalFlow::DEFAULT_NAME, 1],
        'CBR' => ['Cuti besar', RequestCategory::Leave, 22, null, null, false, null, 72, 'Cuti besar', 2],
        'SKT' => ['Sakit', RequestCategory::Sick, null, null, 1, false, null, null, ApprovalFlow::DEFAULT_NAME, 3],
        'IZN' => ['Izin', RequestCategory::Permit, null, null, null, true, null, null, ApprovalFlow::DEFAULT_NAME, 4],
        'LBR' => ['Lembur', RequestCategory::Overtime, null, null, null, false, null, null, 'Lembur', 5],
        'KOR' => ['Koreksi absensi', RequestCategory::Correction, null, null, null, false, 7, null, ApprovalFlow::DEFAULT_NAME, 6],
        'DNS' => ['Dinas luar', RequestCategory::BusinessTrip, null, null, null, false, null, null, 'Dinas luar', 7],
        // Fitur pengajuan: provisional defaults inspired by UU Ketenagakerjaan, to be reviewed by HR.
        'CML' => ['Cuti melahirkan', RequestCategory::Leave, null, null, 0, false, null, null, ApprovalFlow::DEFAULT_NAME, 8],
        'CAP' => ['Cuti alasan penting', RequestCategory::Leave, null, null, null, false, null, null, ApprovalFlow::DEFAULT_NAME, 9],
        'CLT' => ['Cuti di luar tanggungan', RequestCategory::Leave, null, null, null, false, null, null, 'Cuti besar', 10],
        // Keputusan pemilik 6 Okt 2026: Pengajuan barang, atasan langsung lalu Direksi.
        'BRG' => ['Pengajuan barang', RequestCategory::Procurement, null, null, null, false, null, null, 'Pengajuan barang', 11],
    ];

    /**
     * Extra rules of some defaults: code => [is_paid, counts_calendar_days, max_days_per_request, description].
     *
     * @var array<string, array{0: bool, 1: bool, 2: float|null, 3: string}>
     */
    private const array RULES = [
        'CML' => [true, true, 90, 'Maks. 3 bulan (90 hari kalender), mis. 1,5 bulan sebelum dan 1,5 bulan sesudah melahirkan. Lampirkan surat dokter/bidan.'],
        'CAP' => [true, false, 3, 'Per peristiwa, maks. 3 hari: menikah (3), menikahkan/khitan/baptis anak (2), istri melahirkan/keguguran (2), keluarga meninggal (2). Tidak memotong saldo.'],
        'CLT' => [false, false, null, 'Tidak dibayar dan tidak memotong saldo cuti tahunan. Perlu persetujuan Direksi.'],
        'BRG' => [true, false, null, 'Barang atau perlengkapan kerja yang perlu dibeli. Disetujui atasan langsung, lalu Direksi.'],
    ];

    public function run(): void
    {
        $company = Company::query()->orderBy('id')->first();

        if ($company === null) {
            return; // Fresh production install: configured after the company exists.
        }

        $flows = $this->flows($company);
        $this->types($company, $flows);

        $year = OfficeTime::today()->year;
        app(GenerateAnnualBalances::class)->handle($year, $company);

        if (app()->environment(['local', 'testing']) && User::query()->where('email', 'anggota@demo.test')->exists()) {
            $this->demoRequests($year);
        }
    }

    /**
     * @return array<string, ApprovalFlow>
     */
    private function flows(Company $company): array
    {
        $definitions = [
            ApprovalFlow::DEFAULT_NAME => [[ApproverType::DirectManager, null, null], [ApproverType::Role, Role::Hr, null]],
            'Lembur' => [
                [ApproverType::DirectManager, null, null],
                [ApproverType::Role, Role::Hr, null],
                [ApproverType::Role, Role::Direksi, ['overtime_month_minutes_gt' => 2400]],
            ],
            'Cuti besar' => [[ApproverType::DirectManager, null, null], [ApproverType::Role, Role::Hr, null], [ApproverType::Role, Role::Direksi, null]],
            'Dinas luar' => [[ApproverType::DirectManager, null, null], [ApproverType::Role, Role::Direksi, null]],
            // Keputusan pemilik 6 Okt 2026 (skip_self_approval stays on: the default).
            'Pengajuan barang' => [[ApproverType::DirectManager, null, null], [ApproverType::Role, Role::Direksi, null]],
        ];

        $flows = [];

        foreach ($definitions as $name => $steps) {
            $flow = ApprovalFlow::query()->firstOrCreate(['company_id' => $company->id, 'name' => $name]);

            if ($flow->steps()->doesntExist()) {
                foreach ($steps as $index => [$type, $role, $condition]) {
                    $flow->steps()->create([
                        'step_order' => $index + 1,
                        'approver_type' => $type,
                        'approver_role' => $role?->value,
                        'condition' => $condition,
                    ]);
                }
            }

            $flows[$name] = $flow;
        }

        return $flows;
    }

    /**
     * @param  array<string, ApprovalFlow>  $flows
     */
    private function types(Company $company, array $flows): void
    {
        foreach (self::TYPES as $code => [$name, $category, $quota, $carry, $attachment, $halfDay, $backdate, $service, $flow, $sort]) {
            $type = LeaveType::withTrashed()->firstOrNew(['company_id' => $company->id, 'code' => $code]);

            // Idempotent: an existing type (possibly edited by HR) is never overwritten.
            if (! $type->exists) {
                [$paid, $calendar, $max, $description] = self::RULES[$code] ?? [true, false, null, null];

                $type->fill([
                    'name' => $name,
                    'description' => $description,
                    'is_paid' => $paid,
                    'counts_calendar_days' => $calendar,
                    'max_days_per_request' => $max,
                    'is_provisional_default' => true,
                    'category' => $category,
                    'annual_quota_days' => $quota,
                    'carry_over_max_days' => $carry,
                    'requires_attachment_after_days' => $attachment,
                    'allow_half_day' => $halfDay,
                    'max_backdate_days' => $backdate,
                    'min_service_months' => $service,
                    'approval_flow_id' => $flows[$flow]->id,
                    'sort_order' => $sort,
                    // Cuti & lembur wait for the SOP (keputusan pemilik 6 Okt 2026).
                    // Sakit & izin for today are sent before 12.00 (keputusan pemilik 14 Okt 2026).
                    'submit_cutoff_time' => in_array($category, [RequestCategory::Sick, RequestCategory::Permit], true) ? '12:00' : null,
                    'locked_reason' => in_array($category, [RequestCategory::Leave, RequestCategory::Overtime], true) ? LeaveType::SOP_LOCK_REASON : null,
                ])->save();
            }
        }
    }

    private function demoRequests(int $year): void
    {
        $users = User::query()->whereIn('email', [
            'anggota@demo.test', 'kadiv@demo.test', 'hr@demo.test', 'direksi@demo.test', 'sari.wulandari@demo.test',
            'bayu.saputra@demo.test', 'nadia.putri@demo.test', 'maya.lestari@demo.test', 'putri.ramadhani@demo.test',
        ])->get()->keyBy('email');

        $rizky = $users->get('anggota@demo.test');

        if ($rizky === null || $users->count() < 9 || EmployeeRequest::query()->where('user_id', $rizky->id)->exists()) {
            return;
        }

        $types = LeaveType::query()->whereIn('code', array_keys(self::TYPES))->get()->keyBy('code');
        // The demo history was sent before cuti & lembur were locked (keputusan pemilik
        // 6 Okt 2026): unlock in memory only, the stored types stay locked.
        $types->each(function (LeaveType $type): void {
            $type->locked_reason = null;
        });
        $type = fn (string $code): LeaveType => $types->get($code) ?? throw new \LogicException("Missing leave type {$code}");
        $get = fn (string $email): User => $users->get($email) ?? throw new \LogicException("Missing demo user {$email}");

        // "hari tersisa 12": entitlement 12 + carry-over 2, 2 days used earlier this year.
        LeaveBalance::query()->where(['user_id' => $rizky->id, 'leave_type_id' => $type('CUT')->id, 'year' => $year])->update(['carried_over_days' => 2]);

        $existing = EmployeeRequest::query()->pluck('id')->all();
        $original = Notification::getFacadeRoot();
        Notification::fake();

        try {
            $today = OfficeTime::today();
            $nextMonday = $today->next(CarbonImmutable::MONDAY);
            $day = fn (CarbonImmutable $date): string => $date->toDateString();
            $weekday = fn (CarbonImmutable $date): CarbonImmutable => $date->isWeekend() ? $date->next(CarbonImmutable::MONDAY) : $date;
            $mondayBefore = fn (int $days): CarbonImmutable => $today->subDays($days)->startOfWeek();

            // Rizky: history.
            $sick = $this->submit($get('anggota@demo.test'), $type('SKT'), ['start_date' => $day($weekday($today->subDays(94))), 'end_date' => $day($weekday($today->subDays(94)))], $today->subDays(94)->setTime(7, 30), 'Demam, istirahat di rumah.');
            $this->approve($sick, [$get('kadiv@demo.test'), $get('hr@demo.test')]);

            $leaveStart = $mondayBefore(48)->addDays(2); // Wed–Thu (avoids 17 Aug)
            $leave = $this->submit($get('anggota@demo.test'), $type('CUT'), ['start_date' => $day($leaveStart), 'end_date' => $day($leaveStart->addDay())], $leaveStart->subDays(14)->setTime(9, 0), 'Pulang kampung.');
            $this->approve($leave, [$get('kadiv@demo.test'), $get('hr@demo.test')]);

            $overtimeDay = $weekday($today->subDays(25));
            $overtime = $this->submit($get('anggota@demo.test'), $type('LBR'), ['date' => $day($overtimeDay), 'start_time' => '17:00', 'end_time' => '20:00'], $overtimeDay->addDay()->setTime(8, 15), 'Rekap stok akhir bulan.');
            $this->at($overtimeDay->addDay()->setTime(13, 0), fn () => app(RejectStep::class)->handle($get('kadiv@demo.test'), $overtime, 'Tidak ada penugasan lembur sebelumnya.'));

            $permitDay = $weekday($today->subDays(17));
            $permit = $this->submit($get('anggota@demo.test'), $type('IZN'), ['date' => $day($permitDay), 'start_time' => '14:00', 'end_time' => '16:00'], $permitDay->subDays(2)->setTime(10, 0), 'Mengurus dokumen kependudukan.');
            $this->approve($permit, [$get('kadiv@demo.test'), $get('hr@demo.test')]);

            // Waiting for Dimas (Persetujuan) — colleague Nadia is away on the 2nd day.
            $nadia = $this->submit($get('nadia.putri@demo.test'), $type('CUT'), ['start_date' => $day($nextMonday->addDay()), 'end_date' => $day($nextMonday->addDay())], $today->subDays(4)->setTime(9, 0), 'Acara keluarga.');
            $this->approve($nadia, [$get('sari.wulandari@demo.test'), $get('hr@demo.test')]);

            $this->submit($get('anggota@demo.test'), $type('CUT'), ['start_date' => $day($nextMonday), 'end_date' => $day($nextMonday->addDays(2)), 'substitute_id' => $get('bayu.saputra@demo.test')->id], $today->subDays(2)->setTime(10, 12), 'Acara keluarga di luar kota.');
            $this->submit($get('bayu.saputra@demo.test'), $type('IZN'), ['date' => $day($weekday($today->addDays(2))), 'start_time' => '13:00', 'end_time' => '15:00'], $today->setTime(6, 0), 'Kontrol ke dokter gigi.');
            $correctionDay = $today->subDays(3)->isWeekend() ? $today->subDays(3)->previous(CarbonImmutable::FRIDAY) : $today->subDays(3);
            $this->submit($get('sari.wulandari@demo.test'), $type('KOR'), ['date' => $day($correctionDay), 'check_out' => '17:10'], $today->subDay()->setTime(16, 0), 'Lupa check-out, ponsel mati.');

            // Waiting for HR (step 2) and for Direksi (Hana's own leave).
            $maya = $this->submit($get('maya.lestari@demo.test'), $type('CUT'), ['start_date' => $day($nextMonday->addDays(7)), 'end_date' => $day($nextMonday->addDays(8))], $today->subDays(3)->setTime(11, 0), 'Liburan keluarga.');
            $this->approve($maya, [$get('putri.ramadhani@demo.test')]);
            $this->submit($get('hr@demo.test'), $type('CUT'), ['start_date' => $day($nextMonday->addDays(14)), 'end_date' => $day($nextMonday->addDays(14))], $today->subDay()->setTime(9, 30), 'Keperluan pribadi.');

            // Pengajuan barang: Rizky waits for Dimas (then Direksi).
            $this->submit($get('anggota@demo.test'), $type('BRG'), [
                'item_name' => 'Monitor 24 inci', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 2150000,
                'reference_url' => 'https://example.com/monitor-24', 'urgency' => 'biasa',
            ], $today->setTime(8, 40), 'Layar laptop terlalu kecil untuk rekap stok harian.');

            // Seeders write no audit trail (like the other seeders under WithoutModelEvents).
            AuditLog::query()
                ->where('auditable_type', (new EmployeeRequest)->getMorphClass())
                ->whereIn('auditable_id', EmployeeRequest::query()->whereKeyNot($existing)->select('id'))
                ->delete();
        } finally {
            Carbon::setTestNow();
            CarbonImmutable::setTestNow();
            Notification::swap($original);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function submit(User $user, LeaveType $type, array $data, CarbonImmutable $at, string $reason): EmployeeRequest
    {
        return $this->at($at, fn (): EmployeeRequest => app(SubmitRequest::class)->handle($user, RequestInput::fromArray($type, [...$data, 'reason' => $reason])));
    }

    /**
     * Approves step by step, a couple of hours apart.
     *
     * @param  list<User>  $approvers
     */
    private function approve(EmployeeRequest $request, array $approvers): void
    {
        $at = CarbonImmutable::instance($request->submitted_at ?? now());

        foreach ($approvers as $approver) {
            $at = $at->addHours(3);
            $this->at($at, fn () => app(ApproveStep::class)->handle($approver, $request));
        }
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function at(CarbonImmutable $officeTime, callable $callback): mixed
    {
        $instant = $officeTime->utc();
        Carbon::setTestNow($instant);
        CarbonImmutable::setTestNow($instant);

        return $callback();
    }
}
