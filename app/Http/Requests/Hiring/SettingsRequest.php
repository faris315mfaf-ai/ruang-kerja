<?php

namespace App\Http\Requests\Hiring;

use App\Domain\Hiring\Enums\ReviewerRole;
use Illuminate\Contracts\Validation\ValidationRule;

/** Pengaturan hiring: default final approvers + checklist template per role. */
class SettingsRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = [
            'default_final_approver_ids' => ['present', 'array', 'max:10'],
            'default_final_approver_ids.*' => ['string', 'ulid'],
            'checklist_template' => ['required', 'array'],
        ];

        foreach (ReviewerRole::cases() as $role) {
            $rules["checklist_template.{$role->value}"] = ['present', 'array', 'max:12'];
            $rules["checklist_template.{$role->value}.*.label"] = ['required', 'string', 'max:200'];
            $rules["checklist_template.{$role->value}.*.required"] = ['required', 'boolean'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['default_final_approver_ids' => 'penyetuju akhir', 'checklist_template' => 'templat checklist'];
    }

    /**
     * @return list<string>
     */
    public function approverIds(): array
    {
        return array_values(array_filter($this->array('default_final_approver_ids'), 'is_string'));
    }

    /**
     * @return array<string, mixed>
     */
    public function template(): array
    {
        return $this->array('checklist_template');
    }
}
