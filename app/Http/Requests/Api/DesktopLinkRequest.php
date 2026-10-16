<?php

namespace App\Http\Requests\Api;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

/**
 * POST /api/v1/tautan-desktop — `path` must be a plain internal web path on
 * the allowlist (config/api_app_links.php). Anything else (other hosts,
 * query strings, traversal, unlisted pages) is a 422.
 */
class DesktopLinkRequest extends FormRequest
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
            'path' => ['required', 'string', 'max:200', function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value) || ! self::isAllowed($value)) {
                    $fail('Halaman ini tidak dapat dikirim sebagai tautan.');
                }
            }],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'path.required' => 'Halaman tujuan wajib diisi.',
            'path.string' => 'Halaman tujuan tidak valid.',
            'path.max' => 'Halaman tujuan terlalu panjang.',
        ];
    }

    public function path(): string
    {
        return $this->string('path')->toString();
    }

    public static function isAllowed(string $path): bool
    {
        // Plain absolute path only: no scheme/host, query, fragment, spaces,
        // backslashes or control characters; no empty/dot segments.
        if (preg_match('#^/[A-Za-z0-9._~\-/]*$#', $path) !== 1
            || str_contains($path, '//')
            || preg_match('#(^|/)\.\.?(/|$)#', $path) === 1) {
            return false;
        }

        /** @var list<string> $allowed */
        $allowed = config('api_app_links.allowed_paths', []);

        return Str::is($allowed, $path);
    }
}
