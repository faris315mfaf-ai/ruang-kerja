<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Services\ConditionEvaluator;
use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Admin HR: create/update a flow with its ordered steps (replaced as a whole)
 * and optionally assign it to a leave type. Running requests keep the steps
 * they were planned with ("Berlaku untuk pengajuan baru").
 */
final class SaveApprovalFlow
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{name: string, skip_self_approval?: bool, allow_delegation?: bool, steps: list<array{approver_type: string, approver_role?: string|null, approver_user_id?: string|null, condition?: array<string, mixed>|null}>, leave_type_id?: string|null}  $data
     */
    public function handle(User $actor, array $data, ?ApprovalFlow $flow = null): ApprovalFlow
    {
        $steps = $this->normalizeSteps($actor, $data['steps']);

        return DB::transaction(function () use ($actor, $data, $flow, $steps): ApprovalFlow {
            $flow ??= new ApprovalFlow(['company_id' => $actor->company_id]);
            $before = $flow->exists ? $flow->loadMissing('steps')->steps->map(fn (ApprovalFlowStep $step): array => self::snapshot($step))->all() : null;

            $flow->fill([
                'name' => $data['name'],
                'skip_self_approval' => $data['skip_self_approval'] ?? true,
                'allow_delegation' => $data['allow_delegation'] ?? true,
            ])->save();

            $flow->steps()->delete();

            foreach ($steps as $index => $step) {
                $flow->steps()->create([...$step, 'step_order' => $index + 1]);
            }

            $flow->load('steps');

            $this->audit->log('approval_flow.steps_updated', $flow, $before === null ? null : ['steps' => $before], [
                'steps' => $flow->steps->map(fn (ApprovalFlowStep $step): array => self::snapshot($step))->all(),
            ], $actor);

            $typeId = $data['leave_type_id'] ?? null;

            if (is_string($typeId)) {
                $type = LeaveType::query()->where('company_id', $actor->company_id)->findOrFail($typeId);
                // HR configured this type: it is no longer an unreviewed seeded default.
                $type->update(['approval_flow_id' => $flow->id, 'is_provisional_default' => false]);
            }

            return $flow;
        });
    }

    /**
     * @param  list<array{approver_type: string, approver_role?: string|null, approver_user_id?: string|null, condition?: array<string, mixed>|null}>  $steps
     * @return list<array{approver_type: ApproverType, approver_role: string|null, approver_user_id: string|null, condition: array<string, int|float>|null}>
     */
    private function normalizeSteps(User $actor, array $steps): array
    {
        if ($steps === []) {
            throw ValidationException::withMessages(['steps' => 'Alur minimal punya satu langkah.']);
        }

        $normalized = [];

        foreach ($steps as $index => $step) {
            $type = ApproverType::from($step['approver_type']);
            $role = $type === ApproverType::Role ? ($step['approver_role'] ?? null) : null;
            $userId = $type === ApproverType::User ? ($step['approver_user_id'] ?? null) : null;

            if ($type === ApproverType::Role && Role::tryFrom((string) $role) === null) {
                throw ValidationException::withMessages(["steps.{$index}.approver_role" => 'Pilih peran penyetuju.']);
            }

            if ($type === ApproverType::User && ! User::query()->active()->where('company_id', $actor->company_id)->whereKey((string) $userId)->exists()) {
                throw ValidationException::withMessages(["steps.{$index}.approver_user_id" => 'Pilih karyawan aktif sebagai penyetuju.']);
            }

            $condition = null;

            foreach ($step['condition'] ?? [] as $key => $value) {
                if (ConditionEvaluator::parseKey((string) $key) === null || ! is_numeric($value) || $value < 0) {
                    throw ValidationException::withMessages(["steps.{$index}.condition" => 'Kondisi tidak valid.']);
                }

                $condition[(string) $key] = (float) $value == (int) $value ? (int) $value : (float) $value;
            }

            $normalized[] = [
                'approver_type' => $type,
                'approver_role' => $role,
                'approver_user_id' => $userId,
                'condition' => $condition,
            ];
        }

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     */
    private static function snapshot(ApprovalFlowStep $step): array
    {
        return [
            'step_order' => $step->step_order,
            'approver_type' => $step->approver_type->value,
            'approver_role' => $step->approver_role,
            'approver_user_id' => $step->approver_user_id,
            'condition' => $step->condition,
        ];
    }
}
