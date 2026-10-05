<?php

namespace App\Domain\Analytics\Services;

use App\Domain\Analytics\Enums\DashboardView;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;

/**
 * 5-minute cache of dashboard metric blocks (PROMPTS Sprint 9). Keys contain
 * the viewer id, so two people never share an entry even when their filters
 * look alike (no cross-user leaks), plus a hash of the measured scope and
 * the filter.
 */
final class MetricCache
{
    public const string PREFIX = 'analytics:v1';

    /**
     * @template T
     *
     * @param  array<string, mixed>  $parts  scope fingerprint, filter, today …
     * @param  Closure(): T  $callback
     * @return T
     */
    public function remember(DashboardView $view, User $viewer, string $block, array $parts, Closure $callback): mixed
    {
        return $this->store()->remember(self::key($view, $viewer, $block, $parts), config()->integer('analytics.cache_ttl'), $callback);
    }

    /**
     * @param  array<string, mixed>  $parts
     */
    public static function key(DashboardView $view, User $viewer, string $block, array $parts): string
    {
        ksort($parts);

        return implode(':', [self::PREFIX, $view->value, $viewer->id, $block, sha1((string) json_encode($parts))]);
    }

    private function store(): Repository
    {
        $store = config('analytics.cache_store');

        return Cache::store(is_string($store) && $store !== '' ? $store : null);
    }
}
