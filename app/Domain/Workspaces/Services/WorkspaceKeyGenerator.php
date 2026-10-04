<?php

namespace App\Domain\Workspaces\Services;

use App\Models\Workspace;
use Illuminate\Support\Str;

/**
 * Task-number prefixes ("OPS", "PLQ"): 2–10 upper-case letters/digits starting
 * with a letter, unique per company (also against keys used before a rename).
 */
final class WorkspaceKeyGenerator
{
    public const string PATTERN = '/^[A-Z][A-Z0-9]{1,9}$/';

    /** Leading words that describe the type, not the workspace. */
    private const array FILLER = ['divisi', 'tim', 'proyek', 'project', 'team', 'workspace'];

    public static function isValid(string $key): bool
    {
        return preg_match(self::PATTERN, $key) === 1;
    }

    /**
     * A free key derived from $preferred (e.g. a division code) or from $name.
     */
    public function generate(string $companyId, string $name, ?string $preferred = null, ?string $ignoreWorkspaceId = null): string
    {
        $base = self::normalize($preferred ?? '');

        if (! self::isValid($base)) {
            $base = self::fromName($name);
        }

        $candidate = $base;

        for ($suffix = 2; $this->taken($companyId, $candidate, $ignoreWorkspaceId); $suffix++) {
            $candidate = substr($base, 0, 10 - strlen((string) $suffix)).$suffix;
        }

        return $candidate;
    }

    public function taken(string $companyId, string $key, ?string $ignoreWorkspaceId = null): bool
    {
        return Workspace::withTrashed()
            ->where('company_id', $companyId)
            ->when($ignoreWorkspaceId !== null, fn ($query) => $query->whereKeyNot($ignoreWorkspaceId))
            ->where(fn ($query) => $query->where('key', $key)->orWhereJsonContains('previous_keys', $key))
            ->exists();
    }

    public static function normalize(string $key): string
    {
        return (string) preg_replace('/[^A-Z0-9]/', '', Str::upper(Str::ascii($key)));
    }

    /**
     * "Proyek Peluncuran Q4" → "PQ", "Gudang" → "GUD", "Dimas Pratama" → "DP".
     */
    public static function fromName(string $name): string
    {
        $words = array_values(array_filter(
            preg_split('/[^A-Za-z0-9]+/', Str::ascii($name)) ?: [],
            fn (string $word): bool => $word !== '',
        ));

        if (count($words) > 1 && in_array(Str::lower($words[0]), self::FILLER, true)) {
            array_shift($words);
        }

        $key = count($words) > 1
            ? implode('', array_map(fn (string $word): string => $word[0], array_slice($words, 0, 4)))
            : substr($words[0] ?? '', 0, 3);

        $key = self::normalize($key);

        // Must start with a letter and have at least two characters.
        $key = ltrim($key, '0123456789');

        if (strlen($key) < 2) {
            $key = str_pad($key === '' ? 'W' : $key, 2, 'S');
        }

        return substr($key, 0, 10);
    }
}
