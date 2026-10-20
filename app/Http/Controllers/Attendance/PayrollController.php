<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Actions\LockPayrollPeriod;
use App\Domain\Payroll\Actions\SavePayrollRules;
use App\Domain\Payroll\Actions\UnlockPayrollPeriod;
use App\Domain\Payroll\Exports\DailyPayrollExport;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Queries\PayrollCalculator;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payroll\PayrollRulesRequest;
use App\Http\Resources\Attendance\RecapPresenter;
use App\Http\Resources\Attendance\TodayBoard;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Absensi › Gaji (keputusan pemilik 20 Okt 2026): daily wage × paid days per
 * employee, company pay rules, month lock, Excel export
 * (docs/fitur/absensi-gaji.md). payroll.view reads (Direksi read-only),
 * payroll.manage changes.
 */
class PayrollController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, PayrollCalculator $calculator, RecapPresenter $presenter): Response
    {
        Gate::authorize('viewAny', PayrollPeriod::class);

        $now = CarbonImmutable::now();
        $period = $this->period($request, $now);
        $filters = $this->filters($request, $user);

        return Inertia::render('attendance/payroll', [
            'period' => $presenter->period($period),
            'filters' => ['bulan' => $period->key(), 'divisi' => $filters['division_id'], 'q' => $filters['search']],
            'divisions' => TodayBoard::divisionOptions($user),
            'report' => fn (): array => $calculator->forMonth($user, $period, $filters)->toArray(),
            'generatedAt' => $now->toIso8601ZuluString(),
            'can' => [
                'manage' => $user->can('manage', PayrollPeriod::class),
                'export' => true,
            ],
        ]);
    }

    public function export(Request $request, #[CurrentUser] User $user, PayrollCalculator $calculator, AuditLogger $audit): BinaryFileResponse
    {
        Gate::authorize('viewAny', PayrollPeriod::class);

        $period = $this->period($request, CarbonImmutable::now());
        $filters = $this->filters($request, $user);
        $report = $calculator->forMonth($user, $period, $filters);

        $audit->log('payroll.exported', null, null, [
            'month' => $period->key(),
            'division_id' => $filters['division_id'],
            'rows' => count($report->rows),
        ]);

        return Excel::download(new DailyPayrollExport($report), DailyPayrollExport::filename($report));
    }

    public function rules(PayrollRulesRequest $request, #[CurrentUser] User $user, SavePayrollRules $action): RedirectResponse
    {
        Gate::authorize('manage', PayrollPeriod::class);

        $action->handle($user, $request->payrollRules());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Aturan gaji disimpan.']);

        return back();
    }

    public function lock(string $month, #[CurrentUser] User $user, LockPayrollPeriod $action): RedirectResponse
    {
        Gate::authorize('manage', PayrollPeriod::class);

        $period = RecapPeriod::forMonth($this->month($month), CarbonImmutable::now());
        $action->handle($user, $period);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Periode gaji {$period->label()} dikunci."]);

        return back();
    }

    public function unlock(string $month, #[CurrentUser] User $user, UnlockPayrollPeriod $action): RedirectResponse
    {
        Gate::authorize('manage', PayrollPeriod::class);

        $period = RecapPeriod::forMonth($this->month($month), CarbonImmutable::now());
        $action->handle($user, $period);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kunci periode gaji {$period->label()} dibuka."]);

        return back();
    }

    private function period(Request $request, CarbonImmutable $now): RecapPeriod
    {
        return RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);
    }

    private function month(string $month): string
    {
        abort_unless(RecapPeriod::normalize($month, CarbonImmutable::now()) === $month, 404);

        return $month;
    }

    /**
     * @return array{division_id: string|null, search: string|null}
     */
    private function filters(Request $request, User $user): array
    {
        $division = $request->string('divisi')->toString();
        $search = trim($request->string('q')->toString());

        return [
            'division_id' => in_array($division, array_column(TodayBoard::divisionOptions($user), 'id'), true) ? $division : null,
            'search' => $search === '' ? null : mb_substr($search, 0, 80),
        ];
    }
}
