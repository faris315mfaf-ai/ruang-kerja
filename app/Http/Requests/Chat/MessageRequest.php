<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\Actions\AttachMessageFiles;
use App\Rules\RichTextDocument;
use Illuminate\Contracts\Validation\ValidationRule;

/** Send or edit a message: Tiptap body and (on send) Drive attachments / thread root. */
class MessageRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['nullable', 'array', new RichTextDocument],
            'attachments' => ['sometimes', 'array', 'max:'.AttachMessageFiles::MAX_FILES],
            'attachments.*' => ['string', 'ulid'],
            'parent_id' => ['sometimes', 'nullable', 'string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['attachments.max' => 'Maksimal '.AttachMessageFiles::MAX_FILES.' lampiran per pesan.'];
    }
}
