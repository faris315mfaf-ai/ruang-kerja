<?php

namespace App\Http\Requests\Google;

use App\Domain\Google\Services\DriveUploadSessions;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * One chunk of a chunked upload: `offset` (bytes already sent) + `chunk`
 * (multipart file, at most DriveUploadSessions::chunkBytes()).
 */
class DriveUploadChunkRequest extends FormRequest
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
            'offset' => ['required', 'integer', 'min:0'],
            'chunk' => ['required', 'file', 'max:'.(int) ceil(DriveUploadSessions::chunkBytes() / 1024)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'chunk.required' => 'Potongan file tidak terkirim.',
            'chunk.uploaded' => 'Potongan file gagal terkirim. Coba lagi.',
            'chunk.max' => 'Potongan file terlalu besar.',
        ];
    }
}
