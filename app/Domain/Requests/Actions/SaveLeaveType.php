<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Enums\RequestCategory;
use App\Models\ApprovalFlow;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Admin HR: create or update a leave type (jenis pengajuan) and its quota rules.
 * Audited automatically (Auditable). Saving marks the type as reviewed: a seeded
 * default loses its "Bawaan sementara" marker and the seeder never touches it again.
 */
final class SaveLeaveType
{
    /**
     * @param  array<string, mixed>  $data  validated (SaveLeaveTypeRequest)
     */
    public function handle(User $actor, array $data, ?LeaveType $type = null): LeaveType
    {
        $flowId = $data['approval_flow_id'] ?? null;

        if (is_string($flowId) && ! ApprovalFlow::query()->where('company_id', $actor->company_id)->whereKey($flowId)->exists()) {
            throw ValidationException::withMessages(['approval_flow_id' => 'Alur persetujuan tidak ditemukan.']);
        }

        $category = $data['category'] instanceof RequestCategory ? $data['category'] : RequestCategory::from((string) $data['category']);
        $hasQuota = $category === RequestCategory::Leave && isset($data['annual_quota_days']);

        $type ??= new LeaveType(['company_id' => $actor->company_id]);
        $type->fill([
            'code' => $data['code'],
            'name' => $data['name'],
            'category' => $category,
            'description' => $data['description'] ?? null,
            // Only leave (cuti) types consume a yearly balance.
            'annual_quota_days' => $hasQuota ? $data['annual_quota_days'] : null,
            'carry_over_max_days' => $hasQuota ? ($data['carry_over_max_days'] ?? null) : null,
            'allow_half_day' => in_array($category, [RequestCategory::Leave, RequestCategory::Permit], true) && (bool) ($data['allow_half_day'] ?? false),
            'requires_attachment_after_days' => $data['requires_attachment_after_days'] ?? null,
            'max_backdate_days' => $category === RequestCategory::Correction ? ($data['max_backdate_days'] ?? null) : null,
            'min_service_months' => $data['min_service_months'] ?? null,
            'is_paid' => (bool) ($data['is_paid'] ?? true),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'approval_flow_id' => $flowId,
            'sort_order' => $data['sort_order'] ?? $type->sort_order,
            // Calendar days / per-request maximum only make sense for whole-day leave.
            'counts_calendar_days' => $category === RequestCategory::Leave && (bool) ($data['counts_calendar_days'] ?? false),
            'max_days_per_request' => in_array($category, [RequestCategory::Leave, RequestCategory::Permit, RequestCategory::Sick, RequestCategory::BusinessTrip], true)
                ? ($data['max_days_per_request'] ?? null)
                : null,
            'is_provisional_default' => false,
        ]);
        $type->save();

        return $type;
    }
}
