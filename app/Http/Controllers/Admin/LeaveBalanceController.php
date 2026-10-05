<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Requests\Actions\AdjustLeaveBalance;
use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Domain\Requests\Actions\UpdateLeaveBalance;
use App\Domain\Requests\Exports\LeaveBalanceImportTemplate;
use App\Domain\Requests\Imports\LeaveBalanceImport;
use App\Domain\Requests\Services\LeaveEntitlement;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Admin\AdjustLeaveBalanceRequest;
use App\Http\Requests\Admin\LeaveBalanceImportRequest;
use App\Http\Requests\Admin\UpdateLeaveBalanceRequest;
use App\Models\Company;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceAdjustment;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Excel as ExcelType;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Admin › Saldo cuti: balances per employee per year, adjust quota / opening
 * balance, adjustments with a reason, CSV/XLSX import, run the yearly generator.
 */
class LeaveBalanceController extends Controller
{
    public function index(Request $http, #[CurrentUser] User $user): Response
    {
        Gate::authorize('viewAny', LeaveBalance::class);

        $types = LeaveType::query()->visibleTo($user)->whereNotNull('annual_quota_days')->ordered()->get();
        $type = $types->firstWhere('id', $http->query('jenis')) ?? $types->first();
        $currentYear = OfficeTime::today()->year;
        $year = (int) $http->query('tahun', (string) $currentYear);
        $year = $year >= 2000 && $year <= 2100 ? $year : $currentYear;
        $search = trim((string) $http->query('cari', ''));

        $people = User::query()
            ->visibleTo($user)
            ->active()
            ->with(['division:id,name', 'position:id,name'])
            ->when($search !== '', fn (Builder $query) => $query->where('name', 'ilike', '%'.$search.'%'))
            ->orderBy('name')
            ->limit(500)
            ->get();

        $balances = $type === null ? collect() : LeaveBalance::query()
            ->where('leave_type_id', $type->id)
            ->where('year', $year)
            ->whereIn('user_id', $people->pluck('id'))
            ->get()
            ->keyBy('user_id');

        return Inertia::render('admin/leave-balances', [
            'types' => $types->map(fn (LeaveType $t): array => RequestPresenter::type($t))->values()->all(),
            'type' => $type === null ? null : RequestPresenter::type($type),
            'year' => $year,
            'years' => range($currentYear - 2, $currentYear + 1),
            'search' => $search,
            'rows' => $people->map(fn (User $person): array => [
                'user' => RequestPresenter::person($person),
                'eligible' => $type === null || $type->isEligible($person),
                'balance' => RequestPresenter::balance($balances->get($person->id)),
                // Mid-year joiner: entitlement prorated (LeaveEntitlement).
                'prorated' => $person->joined_at !== null && $person->joined_at->year === $year,
                'joined_at' => $person->joined_at?->toDateString(),
            ])->values()->all(),
            // Adjustment history of one balance, loaded on demand (?riwayat=<balance id>).
            'history' => Inertia::optional(fn (): ?array => $this->history($http, $user)),
            'import' => [
                'columns' => LeaveBalanceImport::COLUMNS,
                'required' => LeaveBalanceImport::REQUIRED_COLUMNS,
                'max_kilobytes' => LeaveBalanceImportRequest::MAX_KILOBYTES,
            ],
            'proration' => [
                'example_quota' => $type?->annual_quota_days,
                'example_july' => $type === null ? null : LeaveEntitlement::prorate((float) $type->annual_quota_days, LeaveEntitlement::remainingMonths(7, 1)),
            ],
        ]);
    }

    /**
     * Add (+) or take back (−) days with a reason (audited).
     */
    public function adjust(AdjustLeaveBalanceRequest $form, #[CurrentUser] User $user, LeaveBalance $leaveBalance, AdjustLeaveBalance $adjust): RedirectResponse
    {
        Gate::authorize('update', $leaveBalance);

        $adjust->handle($user, $leaveBalance, (float) $form->validated('delta_days'), (string) $form->validated('reason'));
        Inertia::flash('toast', ['type' => 'success', 'message' => "Penyesuaian saldo {$leaveBalance->loadMissing('user')->user->name} dicatat."]);

        return back();
    }

    public function template(string $format, #[CurrentUser] User $user): BinaryFileResponse
    {
        Gate::authorize('create', LeaveBalance::class);

        return Excel::download(
            new LeaveBalanceImportTemplate(Company::query()->findOrFail($user->company_id), OfficeTime::today()->year),
            "templat-impor-saldo-cuti.{$format}",
            $format === 'xlsx' ? ExcelType::XLSX : ExcelType::CSV,
        );
    }

    /**
     * mode=preview validates the file (nothing written, per-row errors);
     * mode=commit applies the valid rows. The report comes back as flash data.
     */
    public function import(LeaveBalanceImportRequest $form, #[CurrentUser] User $user, LeaveBalanceImport $import): RedirectResponse
    {
        Gate::authorize('create', LeaveBalance::class);

        $file = $form->file('file');
        abort_unless($file instanceof UploadedFile, 422);

        $report = $import->handle($user, $file, $form->commits());
        Inertia::flash('balanceImport', $report);

        if ($form->commits()) {
            $summary = $report['summary'];
            Inertia::flash('toast', [
                'type' => $summary['error'] === 0 ? 'success' : 'warning',
                'message' => "Impor saldo: {$summary['applied']} baris diterapkan, {$summary['error']} dilewati.",
            ]);
        }

        return back();
    }

    /**
     * @return array{balance_id: string, items: list<array{id: string, delta_days: float, reason: string, actor: string|null, created_at: string|null}>}|null
     */
    private function history(Request $http, User $user): ?array
    {
        $id = $http->query('riwayat');
        $balance = is_string($id) ? LeaveBalance::query()->find($id) : null;

        if ($balance === null || ! Gate::forUser($user)->allows('view', $balance)) {
            return null;
        }

        return [
            'balance_id' => $balance->id,
            'items' => array_values($balance->adjustments()->with('actor:id,name')->latest('created_at')->orderByDesc('id')->limit(50)->get()
                ->map(fn (LeaveBalanceAdjustment $adjustment): array => [
                    'id' => $adjustment->id,
                    'delta_days' => $adjustment->delta_days,
                    'reason' => $adjustment->reason,
                    'actor' => $adjustment->actor?->name,
                    'created_at' => $adjustment->created_at?->toIso8601String(),
                ])->all()),
        ];
    }

    public function update(UpdateLeaveBalanceRequest $form, #[CurrentUser] User $user, LeaveBalance $leaveBalance, UpdateLeaveBalance $update): RedirectResponse
    {
        Gate::authorize('update', $leaveBalance);

        $opening = $form->validated('opening_days');
        $update->handle(
            $user,
            $leaveBalance,
            (float) $form->validated('entitled_days'),
            (float) $form->validated('carried_over_days'),
            is_numeric($opening) ? (float) $opening : null,
        );
        Inertia::flash('toast', ['type' => 'success', 'message' => "Saldo {$leaveBalance->loadMissing('user')->user->name} disimpan."]);

        return back();
    }

    public function generate(Request $http, #[CurrentUser] User $user, GenerateAnnualBalances $generate): RedirectResponse
    {
        Gate::authorize('create', LeaveBalance::class);

        $validated = $http->validate(['year' => ['required', 'integer', 'min:2000', 'max:2100']], [
            'year.*' => 'Tahun tidak valid.',
        ]);
        $year = (int) $validated['year'];

        $result = $generate->handle($year, $user->company);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Saldo {$year}: {$result['created']} dibuat, {$result['completed']} dilengkapi, {$result['skipped']} sudah ada/dilewati."]);

        return back();
    }
}
