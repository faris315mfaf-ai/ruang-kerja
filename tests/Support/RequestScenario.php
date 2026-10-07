<?php

namespace Tests\Support;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\ApproveStep;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestCategory;
use App\Models\ApprovalFlow;
use App\Models\Division;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;

/**
 * A small organization for request tests (RoleSeeder must be seeded first):
 *
 *   Direksi (direksi) ← Kepala divisi Operasional (manager, head) ← employee
 *   HR (hr role, reports to direksi)
 *
 * Default flow: Atasan langsung → HR. Leave types for every category.
 */
final class RequestScenario
{
    public User $direksi;

    public User $hr;

    public User $manager;

    public User $employee;

    public Division $division;

    public ApprovalFlow $flow;

    public LeaveType $annual;

    public LeaveType $permit;

    public LeaveType $sick;

    public LeaveType $overtime;

    public LeaveType $correction;

    public LeaveType $trip;

    /** Pengajuan barang (BRG): atasan langsung → Direksi. */
    public LeaveType $procurement;

    public ApprovalFlow $procurementFlow;

    public static function make(): self
    {
        $scenario = new self;

        $scenario->direksi = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Wijaya']);
        $scenario->hr = User::factory()->withRole(Role::Hr)->managedBy($scenario->direksi)->create(['name' => 'Hana Pratiwi']);
        $scenario->manager = User::factory()->withRole(Role::KepalaDivisi)->managedBy($scenario->direksi)->create(['name' => 'Dimas Pratama']);
        $scenario->division = Division::factory()->headedBy($scenario->manager)->create(['name' => 'Operasional', 'code' => 'OPS']);
        $scenario->manager->update(['division_id' => $scenario->division->id]);
        $scenario->employee = User::factory()
            ->withRole(Role::Anggota)
            ->inDivision($scenario->division)
            ->managedBy($scenario->manager)
            ->create(['name' => 'Rizky Aditya']);

        $scenario->flow = ApprovalFlow::factory()->managerThenHr()->create(['name' => ApprovalFlow::DEFAULT_NAME]);

        $make = fn (RequestCategory $category, string $code, string $name, array $extra = []): LeaveType => LeaveType::factory()
            ->category($category)
            ->withFlow($scenario->flow)
            ->create(['code' => $code, 'name' => $name, ...$extra]);

        $scenario->annual = $make(RequestCategory::Leave, 'CUT', 'Cuti tahunan', ['annual_quota_days' => 12, 'carry_over_max_days' => 5]);
        $scenario->permit = $make(RequestCategory::Permit, 'IZN', 'Izin', ['allow_half_day' => true]);
        $scenario->sick = $make(RequestCategory::Sick, 'SKT', 'Sakit', ['requires_attachment_after_days' => 1]);
        $scenario->overtime = $make(RequestCategory::Overtime, 'LBR', 'Lembur');
        $scenario->correction = $make(RequestCategory::Correction, 'KOR', 'Koreksi absensi', ['max_backdate_days' => 7]);
        $scenario->trip = $make(RequestCategory::BusinessTrip, 'DNS', 'Dinas luar');
        $scenario->procurementFlow = ApprovalFlow::factory()
            ->withSteps([[ApproverType::DirectManager], [ApproverType::Role, Role::Direksi]])
            ->create(['name' => 'Pengajuan barang']);
        $scenario->procurement = LeaveType::factory()->procurement()->withFlow($scenario->procurementFlow)
            ->create(['code' => 'BRG', 'name' => 'Pengajuan barang']);

        return $scenario;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function input(LeaveType $type, array $data = []): RequestInput
    {
        return RequestInput::fromArray($type, ['reason' => 'Keperluan keluarga.', ...$data]);
    }

    /**
     * Submits a request through the real action.
     *
     * @param  array<string, mixed>  $data
     */
    public function submit(User $user, LeaveType $type, array $data): EmployeeRequest
    {
        return app(SubmitRequest::class)->handle($user, self::input($type, $data))->fresh(['approvals', 'user', 'leaveType']) ?? throw new \LogicException;
    }

    public function approve(User $actor, EmployeeRequest $request, ?string $note = null): EmployeeRequest
    {
        return app(ApproveStep::class)->handle($actor, $request, $note)->fresh(['approvals', 'user', 'leaveType']) ?? throw new \LogicException;
    }

    /**
     * Flow with the given steps assigned to $type.
     *
     * @param  list<array{0: ApproverType, 1?: Role|User|null, 2?: array<string, int|float>|null}>  $steps
     * @param  array<string, mixed>  $attributes
     */
    public function useFlow(LeaveType $type, array $steps, array $attributes = []): ApprovalFlow
    {
        $flow = ApprovalFlow::factory()->withSteps($steps)->create($attributes);
        $type->update(['approval_flow_id' => $flow->id]);

        return $flow;
    }
}
