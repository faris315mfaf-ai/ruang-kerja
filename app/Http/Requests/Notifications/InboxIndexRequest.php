<?php

namespace App\Http\Requests\Notifications;

use App\Domain\Notifications\Data\InboxFilters;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InboxIndexRequest extends FormRequest
{
    /**
     * Authorization happens in the controller (InboxNotificationPolicy::viewAny).
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tab' => ['nullable', 'string', Rule::in(InboxFilters::TABS)],
            'kind' => ['nullable', 'string', Rule::in(InboxFilters::kinds())],
            'archived' => ['nullable', 'boolean'],
        ];
    }

    public function filters(): InboxFilters
    {
        return new InboxFilters(
            tab: $this->string('tab', 'all')->toString() ?: 'all',
            kind: $this->filled('kind') ? $this->string('kind')->toString() : null,
            archived: $this->boolean('archived'),
        );
    }
}
