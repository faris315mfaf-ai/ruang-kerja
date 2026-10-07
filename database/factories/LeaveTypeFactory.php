<?php

namespace Database\Factories;

use App\Domain\Requests\Enums\RequestCategory;
use App\Models\ApprovalFlow;
use App\Models\LeaveType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LeaveType>
 */
class LeaveTypeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'code' => strtoupper(fake()->unique()->lexify('???')),
            'name' => 'Cuti '.fake()->unique()->word(),
            'category' => RequestCategory::Leave,
            'annual_quota_days' => 12,
            'requires_attachment_after_days' => null,
            'is_paid' => true,
            'allow_half_day' => true,
            'carry_over_max_days' => null,
            'approval_flow_id' => null,
            'is_active' => true,
        ];
    }

    public function category(RequestCategory $category): static
    {
        return $this->state(fn (): array => [
            'category' => $category,
            'name' => $category->label().' '.fake()->unique()->word(),
            'annual_quota_days' => $category === RequestCategory::Leave ? 12 : null,
            'allow_half_day' => $category === RequestCategory::Leave,
        ]);
    }

    /** Pengajuan barang (keputusan pemilik 6 Okt 2026). */
    public function procurement(): static
    {
        return $this->category(RequestCategory::Procurement)->state(fn (): array => ['name' => 'Pengajuan barang', 'allow_half_day' => false]);
    }

    /** Locked: visible, cannot be requested (cuti & lembur until the SOP exists). */
    public function locked(?string $reason = null): static
    {
        return $this->state(fn (): array => ['locked_reason' => $reason ?? LeaveType::SOP_LOCK_REASON]);
    }

    public function withoutQuota(): static
    {
        return $this->state(fn (): array => ['annual_quota_days' => null]);
    }

    public function withFlow(ApprovalFlow $flow): static
    {
        return $this->state(fn (): array => ['approval_flow_id' => $flow->id, 'company_id' => $flow->company_id]);
    }
}
