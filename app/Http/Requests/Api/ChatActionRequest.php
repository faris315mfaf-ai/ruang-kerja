<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Chat\ChatRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Body-less Obrolan calls (delete a message, join, read-by, members): only
 * the 404-before-anything rule of ChatRequest applies.
 */
class ChatActionRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [];
    }
}
