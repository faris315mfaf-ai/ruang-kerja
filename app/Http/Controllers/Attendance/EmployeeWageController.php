<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Payroll\Actions\DeleteEmployeeWage;
use App\Domain\Payroll\Actions\SaveEmployeeWage;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Queries\PayrollCalculator;
use App\Domain\Payroll\Services\PayrollLock;
use App\Http\Controllers\Attendance\Concerns\FindsCompanyEmployee;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payroll\EmployeeWageRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Absensi › Gaji › Upah harian of one employee: history (JSON for the
 * dialog), set from a date on, delete one row.
 */
class EmployeeWageController extends Controller
{
    use FindsCompanyEmployee;

    public function index(string $employee, #[CurrentUser] User $user, PayrollLock $lock): JsonResponse
    {
        Gate::authorize('viewAny', PayrollPeriod::class);

        $person = $this->companyEmployee($user, $employee);

        Gate::authorize('viewWages', [EmployeeWage::class, $person]);

        $wages = EmployeeWage::query()
            ->with('creator:id,name')
            ->where('user_id', $person->id)
            ->orderByDesc('effective_from')
            ->get();
        $today = ScheduleResolver::officeDate(CarbonImmutable::now())->toDateString();
        $history = array_values($wages->sortBy(fn (EmployeeWage $wage): string => $wage->effective_from->toDateString())
            ->map(fn (EmployeeWage $wage): array => [$wage->effective_from->toDateString(), $wage->daily_wage])->all());

        return response()->json([
            'employee' => ['id' => $person->id, 'name' => $person->name],
            'current' => PayrollCalculator::wageOn($history, $today),
            'wages' => array_values($wages->map(fn (EmployeeWage $wage): array => [
                'id' => $wage->id,
                'daily_wage' => $wage->daily_wage,
                'effective_from' => $wage->effective_from->toDateString(),
                'note' => $wage->note,
                'created_by_name' => $wage->creator?->name,
                'updated_at' => $wage->updated_at?->toIso8601ZuluString(),
                'locked' => $lock->isLocked($wage->company_id, $wage->effective_from),
            ])->all()),
            'can' => ['manage' => $user->can('manageWages', [EmployeeWage::class, $person])],
        ]);
    }

    public function update(EmployeeWageRequest $request, string $employee, #[CurrentUser] User $user, SaveEmployeeWage $action): RedirectResponse
    {
        $person = $this->companyEmployee($user, $employee);

        Gate::authorize('manageWages', [EmployeeWage::class, $person]);

        $action->handle(
            $user,
            $person,
            $request->integer('daily_wage'),
            $request->string('effective_from')->toString(),
            $request->filled('note') ? $request->string('note')->toString() : null,
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => "Upah harian {$person->name} disimpan."]);

        return back();
    }

    public function destroy(EmployeeWage $wage, #[CurrentUser] User $user, DeleteEmployeeWage $action): RedirectResponse
    {
        abort_unless($wage->company_id === $user->company_id, 404);

        Gate::authorize('delete', $wage);

        $action->handle($user, $wage);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Upah harian dihapus.']);

        return back();
    }
}
