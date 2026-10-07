<?php

namespace App\Models;

use App\Domain\Hiring\Services\ChecklistTemplate;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Hiring defaults per company (docs/DATABASE.md §4b): the default final
 * approvers of new positions and the checklist template per reviewer role.
 *
 * @property string $id
 * @property string $company_id
 * @property list<string> $default_final_approver_ids
 * @property array<string, list<array{label: string, required: bool}>> $checklist_template
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['company_id', 'default_final_approver_ids', 'checklist_template'])]
class HiringSetting extends Model
{
    use HasUlids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'default_final_approver_ids' => '[]',
        'checklist_template' => '{}',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'default_final_approver_ids' => 'array',
            'checklist_template' => 'array',
        ];
    }

    /**
     * The company's settings, or unsaved defaults when HR never saved them.
     */
    public static function forCompany(string $companyId): self
    {
        return self::query()->where('company_id', $companyId)->first()
            ?? new self(['company_id' => $companyId, 'default_final_approver_ids' => [], 'checklist_template' => ChecklistTemplate::defaults()]);
    }

    /**
     * Template with built-in defaults for roles HR left empty.
     *
     * @return array<string, list<array{label: string, required: bool}>>
     */
    public function template(): array
    {
        return ChecklistTemplate::normalize($this->checklist_template);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
