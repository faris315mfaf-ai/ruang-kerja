<?php

namespace App\Rules;

use App\Domain\Tasks\Services\RichText;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A Tiptap/ProseMirror JSON document within RichText limits. Content is
 * sanitized afterwards by the action (RichText::sanitize).
 */
final class RichTextDocument implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $violation = RichText::violation($value);

        if ($violation !== null) {
            $fail($violation);
        }
    }
}
