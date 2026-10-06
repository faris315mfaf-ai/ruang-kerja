<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Organization\Enums\UserStatus;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/** Add (POST) or change (PATCH) a follow-up of the minutes. */
class ActionItemRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->user();

        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'text' => ['sometimes', 'nullable', 'string', 'max:300'],
            'assignee_id' => ['sometimes', 'nullable', 'string', 'ulid', Rule::exists('users', 'id')
                ->where('company_id', $user instanceof User ? $user->company_id : null)
                ->where('status', UserStatus::Active->value)],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'done' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['text' => 'tindak lanjut', 'assignee_id' => 'penanggung jawab', 'due_date' => 'tenggat'];
    }

    /**
     * @return array{text?: string|null, assignee_id?: string|null, due_date?: string|null, done?: bool}
     */
    public function fields(): array
    {
        $fields = [];

        foreach (['text', 'assignee_id', 'due_date'] as $key) {
            if ($this->has($key)) {
                $value = $this->input($key);
                $fields[$key] = is_string($value) && $value !== '' ? $value : ($key === 'text' ? '' : null);
            }
        }

        if ($this->has('done')) {
            $fields['done'] = $this->boolean('done');
        }

        return $fields;
    }

    /** Only the checklist tick was sent. */
    public function onlyDone(): bool
    {
        return array_keys($this->fields()) === ['done'];
    }
}
