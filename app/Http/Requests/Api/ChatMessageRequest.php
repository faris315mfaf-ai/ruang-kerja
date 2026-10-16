<?php

namespace App\Http\Requests\Api;

use App\Domain\Chat\Actions\AttachMessageFiles;
use App\Http\Requests\Chat\ChatRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * POST /api/v1/obrolan/kanal/{channel}/pesan (alias /obrolan/{channel}/pesan)
 * — a message from the mobile app. The web body is a Tiptap document; the app
 * sends plain text plus the ids its composer resolved (`mentions`,
 * `task_refs`, `attachments` = Drive file ids, `parent_id` = thread root);
 * ComposeMessageDocument turns them into the same document the web stores, so
 * PostMessage, its mentions and its notifications run unchanged. A channel
 * the user may not read answers 404 before validation (ChatRequest).
 */
class ChatMessageRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['nullable', 'string', 'max:20000', 'required_without:attachments'],
            'parent_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'mentions' => ['sometimes', 'array', 'max:20'],
            'mentions.*' => ['string', 'ulid'],
            'task_refs' => ['sometimes', 'array', 'max:20'],
            'task_refs.*' => ['string', 'ulid'],
            'attachments' => ['sometimes', 'array', 'max:'.AttachMessageFiles::MAX_FILES],
            'attachments.*' => ['string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Pesan tidak boleh kosong.',
            'body.required_without' => 'Pesan tidak boleh kosong.',
            'body.max' => 'Pesan maksimal 20.000 karakter.',
            'attachments.max' => 'Maksimal '.AttachMessageFiles::MAX_FILES.' lampiran per pesan.',
            'mentions.max' => 'Maksimal 20 orang yang bisa disebut dalam satu pesan.',
            'task_refs.max' => 'Maksimal 20 rujukan tugas dalam satu pesan.',
        ];
    }
}
