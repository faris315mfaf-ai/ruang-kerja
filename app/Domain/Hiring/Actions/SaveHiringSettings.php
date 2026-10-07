<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Services\ChecklistTemplate;
use App\Domain\Hiring\Services\HiringAccess;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\HiringSetting;
use App\Models\User;

/**
 * HR saves the company's hiring defaults: the final approvers new positions
 * start with (e.g. Faris & Dio) and the checklist template per reviewer role.
 * Existing positions and candidates keep what they have.
 */
final class SaveHiringSettings
{
    public function __construct(
        private readonly HiringAccess $access,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{default_final_approver_ids: list<string>, checklist_template: array<string, mixed>}  $data
     */
    public function handle(User $actor, array $data): HiringSetting
    {
        $setting = HiringSetting::query()->firstOrNew(['company_id' => $actor->company_id]);
        $old = $setting->exists ? ['default_final_approver_ids' => $setting->default_final_approver_ids] : null;

        $setting->fill([
            'default_final_approver_ids' => $this->access->activeEmployeeIds($actor->company_id, $data['default_final_approver_ids']),
            'checklist_template' => ChecklistTemplate::normalize($data['checklist_template']),
        ])->save();

        $this->audit->log('hiring.settings_updated', $setting, $old, [
            'default_final_approver_ids' => $setting->default_final_approver_ids,
        ], $actor);

        return $setting;
    }
}
