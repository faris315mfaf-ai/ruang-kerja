<?php

namespace App\Http\Requests\Notifications;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class NotificationFeedRequest extends FormRequest
{
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
            'after' => ['nullable', 'date'],
        ];
    }

    /**
     * Polling cursor; defaults to "now" (only the counter is needed then).
     * Never older than one day to keep the response small.
     */
    public function cursor(): CarbonImmutable
    {
        $after = $this->filled('after')
            ? CarbonImmutable::parse($this->string('after')->toString())
            : CarbonImmutable::now();

        return $after->max(CarbonImmutable::now()->subDay());
    }
}
