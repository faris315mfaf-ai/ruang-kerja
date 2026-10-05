<?php

namespace App\Domain\Requests\Services;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Data\PlannedStep;
use App\Domain\Requests\Data\StepDefinition;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\ApprovalFlow;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Plans and advances the approval steps of a request (ARCHITECTURE §3.4).
 *
 * - start(): creates the round's steps; conditions are decided at submission
 *   (not met → skipped with an explanation), then activates the first step.
 * - advance(): activates the next queued step, resolving the approver at that
 *   moment (delegation, self-approval, already-approved approver → skip).
 * - preview(): same resolution in memory, for the form and the admin screen.
 */
final class ApprovalFlowResolver
{
    public function __construct(
        private readonly ApproverResolver $approvers,
        private readonly ConditionEvaluator $conditions,
    ) {}

    /**
     * The flow of a leave type (or the company "Default" flow) and its steps.
     * Without any configured flow: Atasan langsung → HR.
     *
     * @return array{flow: ApprovalFlow|null, steps: list<StepDefinition>}
     */
    public function definitionFor(LeaveType $type): array
    {
        $flow = $type->approval_flow_id === null ? null : ApprovalFlow::query()->with('steps')->find($type->approval_flow_id);

        $flow ??= ApprovalFlow::query()
            ->with('steps')
            ->where('company_id', $type->company_id)
            ->where('name', ApprovalFlow::DEFAULT_NAME)
            ->first();

        $steps = $flow === null ? [] : array_values($flow->steps->map(fn ($step) => StepDefinition::fromModel($step))->all());

        if ($steps === []) {
            $steps = [new StepDefinition(ApproverType::DirectManager), new StepDefinition(ApproverType::Role, Role::Hr->value)];
        }

        return ['flow' => $flow, 'steps' => $steps];
    }

    /**
     * Creates the steps of the request's current round and activates the first.
     * Call inside the submit transaction.
     *
     * @throws ValidationException when nobody at all can approve the request
     */
    public function start(EmployeeRequest $request): RequestApproval
    {
        $request->loadMissing(['user', 'leaveType']);
        ['flow' => $flow, 'steps' => $definitions] = $this->definitionFor($request->leaveType);

        foreach ($definitions as $index => $definition) {
            $condition = $this->conditions->evaluate($definition->condition, $request);

            $request->approvals()->create([
                'round' => $request->round,
                'step_order' => $index + 1,
                'approver_type' => $definition->type,
                'approver_role' => $definition->type === ApproverType::Role ? $definition->role : null,
                'approver_id' => $definition->type === ApproverType::User ? $definition->userId : null,
                'status' => $condition['passes'] ? ApprovalStatus::Queued : ApprovalStatus::Skipped,
                'note' => $condition['passes'] ? null : 'Kondisi tidak terpenuhi: '.$condition['explanation'].'.',
            ]);
        }

        $request->unsetRelation('approvals');
        $waiting = $this->advance($request, $flow);

        if ($waiting !== null) {
            return $waiting;
        }

        // Every step was skipped and nobody approved: route to a fallback role.
        $role = $this->fallbackRole($request->user);

        if ($role === null) {
            throw ValidationException::withMessages(['leave_type_id' => 'Tidak ada penyetuju yang tersedia untuk pengajuan ini. Hubungi HR.']);
        }

        $request->approvals()->create([
            'round' => $request->round,
            'step_order' => count($definitions) + 1,
            'approver_type' => ApproverType::Role,
            'approver_role' => $role,
            'status' => ApprovalStatus::Queued,
            'note' => 'Langkah cadangan: semua langkah alur terlewati.',
        ]);
        $request->unsetRelation('approvals');

        return $this->advance($request, $flow) ?? throw ValidationException::withMessages([
            'leave_type_id' => 'Tidak ada penyetuju yang tersedia untuk pengajuan ini. Hubungi HR.',
        ]);
    }

    /**
     * Activates the next queued step of the current round. Returns the step now
     * waiting, or null when no step is left (the request is fully approved).
     */
    public function advance(EmployeeRequest $request, ?ApprovalFlow $flow = null): ?RequestApproval
    {
        $request->loadMissing(['user', 'leaveType']);
        $flow ??= $this->definitionFor($request->leaveType)['flow'];
        $steps = $request->currentSteps();
        $today = OfficeTime::todayString();

        foreach ($steps as $step) {
            if ($step->status !== ApprovalStatus::Queued) {
                continue;
            }

            $resolved = $this->resolve(
                $request,
                $step->step_order,
                $step->approver_type,
                $step->approver_role,
                $step->approver_id,
                $request->approverIdsOfRound(),
                $flow->skip_self_approval ?? true,
                $flow->allow_delegation ?? true,
                $today,
            );

            $step->fill([
                'status' => $resolved->status,
                // A role step may move to a fallback role (holders already approved).
                'approver_role' => $step->approver_type === ApproverType::Role ? $resolved->role : $step->approver_role,
                // A skipped fixed-person step keeps showing who it was meant for.
                'approver_id' => $resolved->approver->id ?? ($step->approver_type === ApproverType::User ? $step->approver_id : null),
                'delegated_from_id' => $resolved->delegatedFrom?->id,
                'note' => $resolved->note ?? $step->note,
                'activated_at' => $resolved->status === ApprovalStatus::Waiting ? now() : null,
            ])->save();

            if ($resolved->status === ApprovalStatus::Waiting) {
                $request->forceFill(['current_step' => $step->step_order])->save();

                return $step;
            }
        }

        $request->forceFill(['current_step' => null])->save();

        return null;
    }

    /**
     * Resolution of the whole flow for a not-yet-submitted request, as if each
     * step were approved by its resolved approver in turn.
     *
     * @return list<PlannedStep>
     */
    public function preview(EmployeeRequest $request): array
    {
        ['flow' => $flow, 'steps' => $definitions] = $this->definitionFor($request->leaveType);

        return $this->previewSteps($request, $definitions, $flow->skip_self_approval ?? true, $flow->allow_delegation ?? true);
    }

    /**
     * Preview with explicit (possibly unsaved) step definitions — admin editor.
     *
     * @param  list<StepDefinition>  $definitions
     * @return list<PlannedStep>
     */
    public function previewSteps(EmployeeRequest $request, array $definitions, bool $skipSelf, bool $allowDelegation): array
    {
        $today = OfficeTime::todayString();
        $approved = [];
        $planned = [];
        $hasWaiting = false;

        foreach ($definitions as $index => $definition) {
            $condition = $this->conditions->evaluate($definition->condition, $request);

            if (! $condition['passes']) {
                $planned[] = new PlannedStep($index + 1, $definition->type, $definition->role, ApprovalStatus::Skipped, null, null, 'Kondisi tidak terpenuhi: '.$condition['explanation']);

                continue;
            }

            $resolved = $this->resolve(
                $request,
                $index + 1,
                $definition->type,
                $definition->role,
                $definition->userId,
                $approved,
                $skipSelf,
                $allowDelegation,
                $today,
            );

            if ($resolved->status === ApprovalStatus::Waiting) {
                foreach ([$resolved->approver, $resolved->delegatedFrom] as $person) {
                    if ($person !== null) {
                        $approved[] = $person->id;
                    }
                }

                $resolved = new PlannedStep(
                    $resolved->stepOrder,
                    $resolved->type,
                    $resolved->role,
                    $hasWaiting ? ApprovalStatus::Queued : ApprovalStatus::Waiting,
                    $resolved->approver,
                    $resolved->delegatedFrom,
                    $resolved->note,
                );
                $hasWaiting = true;
            }

            $planned[] = $resolved;
        }

        if (! $hasWaiting && ($role = $this->fallbackRole($request->user)) !== null) {
            $planned[] = new PlannedStep(count($definitions) + 1, ApproverType::Role, $role, ApprovalStatus::Waiting, null, null, 'Langkah cadangan: semua langkah alur terlewati.');
        }

        return $planned;
    }

    /**
     * Resolves one step now.
     *
     * @param  list<string>  $approvedIds  approvers who already approved this round
     */
    public function resolve(
        EmployeeRequest $request,
        int $stepOrder,
        ApproverType $type,
        ?string $role,
        ?string $userId,
        array $approvedIds,
        bool $skipSelf,
        bool $allowDelegation,
        string $today,
    ): PlannedStep {
        $requester = $request->user;
        $skip = fn (string $note): PlannedStep => new PlannedStep($stepOrder, $type, $role, ApprovalStatus::Skipped, note: $note);

        if ($type === ApproverType::Role) {
            return $this->resolveRole($requester, $stepOrder, $role, $approvedIds);
        }

        $person = $this->approvers->person($type, $userId, $requester);

        if ($person === null) {
            return $skip(match ($type) {
                ApproverType::DirectManager => 'Pemohon tidak punya atasan langsung.',
                ApproverType::DivisionHead => 'Divisi pemohon tidak punya kepala divisi.',
                default => 'Penyetuju tidak tersedia atau tidak aktif.',
            });
        }

        if ($person->is($requester)) {
            if ($skipSelf) {
                return $skip('Penyetuju adalah pemohon sendiri.');
            }

            $person = $this->approvers->escalate($requester, $approvedIds);

            if ($person === null) {
                return $skip('Penyetuju adalah pemohon dan tidak ada atasan di atasnya.');
            }
        }

        if (in_array($person->id, $approvedIds, true)) {
            return $skip("Sudah disetujui {$person->name} di langkah sebelumnya.");
        }

        $delegatedFrom = null;

        if ($allowDelegation) {
            $delegate = $this->approvers->activeDelegate($person, $today);

            // Never to the requester or to someone who already approved this round.
            if ($delegate !== null && ! $delegate->is($requester) && ! in_array($delegate->id, $approvedIds, true)) {
                $delegatedFrom = $person;
                $person = $delegate;
            }
        }

        return new PlannedStep($stepOrder, $type, $role, ApprovalStatus::Waiting, $person, $delegatedFrom);
    }

    /**
     * A role step is decided by any holder who has not approved this round yet.
     * When every holder already approved (e.g. the Kepala Divisi HR approved as
     * direct manager), the step moves to the next fallback role (HR → Direksi →
     * Super Admin) so a second person still decides.
     *
     * @param  list<string>  $approvedIds
     */
    private function resolveRole(User $requester, int $stepOrder, ?string $role, array $approvedIds): PlannedStep
    {
        $label = self::roleLabel($role);

        if ($role === null || ! $this->approvers->roleHolders($role, $requester)->exists()) {
            return new PlannedStep($stepOrder, ApproverType::Role, $role, ApprovalStatus::Skipped, note: "Tidak ada pemegang peran {$label} selain pemohon.");
        }

        if ($this->approvers->roleHolders($role, $requester)->whereKeyNot($approvedIds)->exists()) {
            return new PlannedStep($stepOrder, ApproverType::Role, $role, ApprovalStatus::Waiting);
        }

        $fallback = $this->fallbackRole($requester, $approvedIds, $role);

        return $fallback === null
            ? new PlannedStep($stepOrder, ApproverType::Role, $role, ApprovalStatus::Skipped, note: "Semua pemegang peran {$label} sudah menyetujui di langkah sebelumnya.")
            : new PlannedStep($stepOrder, ApproverType::Role, $fallback, ApprovalStatus::Waiting, note: "Pemegang peran {$label} sudah menyetujui di langkah sebelumnya; dialihkan ke ".self::roleLabel($fallback).'.');
    }

    private static function roleLabel(?string $role): string
    {
        return Role::tryFrom((string) $role)?->label() ?? (string) $role;
    }

    /**
     * First fallback role with a holder other than the requester and the people
     * in $exclude.
     *
     * @param  list<string>  $exclude
     */
    private function fallbackRole(User $requester, array $exclude = [], ?string $except = null): ?string
    {
        /** @var list<string> $roles */
        $roles = config('requests.fallback_roles', []);

        foreach ($roles as $role) {
            if ($role !== $except && $this->approvers->roleHolders($role, $requester)->whereKeyNot($exclude)->exists()) {
                return $role;
            }
        }

        return null;
    }
}
