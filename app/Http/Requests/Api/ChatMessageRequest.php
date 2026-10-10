<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/obrolan/kanal/{channel}/pesan — a plain-text message from
 * the mobile app. The web body is a Tiptap document; the app sends a string,
 * which the controller wraps into the same minimal document the web stores
 * (RichText::fromText), so PostMessage, its mentions and its notifications
 * run unchanged. Reading rights (404 for non-members of a private channel)
 * are checked by the controller behind ChannelPolicy.
 */
class ChatMessageRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:20000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Pesan tidak boleh kosong.',
            'body.max' => 'Pesan maksimal 20.000 karakter.',
        ];
    }
}
