<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Domain\Requests\Actions\UpdateLeaveBalance;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Admin\UpdateLeaveBalanceRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Saldo cuti: balances per employee per year, adjust quota, run the yearly generator.
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
            ])->values()->all(),
        ]);
    }

    public function update(UpdateLeaveBalanceRequest $form, #[CurrentUser] User $user, LeaveBalance $leaveBalance, UpdateLeaveBalance $update): RedirectResponse
    {
        Gate::authorize('update', $leaveBalance);

        $update->handle($user, $leaveBalance, (float) $form->validated('entitled_days'), (float) $form->validated('carried_over_days'));
        Inertia::flash('toast', ['type' => 'success', 'message' => "Saldo {$leaveBalance->user->name} disimpan."]);

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
        Inertia::flash('toast', ['type' => 'success', 'message' => "Saldo {$year}: {$result['created']} dibuat, {$result['skipped']} sudah ada/dilewati."]);

        return back();
    }
}
