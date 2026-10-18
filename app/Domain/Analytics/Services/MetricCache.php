<?php

namespace App\Domain\Analytics\Services;

use App\Domain\Analytics\Enums\DashboardView;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;

/**
 * 5-minute cache of dashboard metric blocks (PROMPTS Sprint 9). Keys contain
 * the viewer's company and id, so two people never share an entry even when
 * their filters look alike (no cross-user or cross-company leaks, Fase 1
 * multi-perusahaan), plus a hash of the measured scope and the filter.
 */
final class MetricCache
{
    public const string PREFIX = 'analytics:v2';

    /**
     * @template T
     *
     * @param  DashboardView|string  $view  a dashboard view, or the key of a dashboard outside the picker (e.g. "manajemen")
     * @param  array<string, mixed>  $parts  scope fingerprint, filter, today …
     * @param  Closure(): T  $callback
     * @return T
     */
    public function remember(DashboardView|string $view, User $viewer, string $block, array $parts, Closure $callback): mixed
    {
        return $this->store()->remember(self::key($view, $viewer, $block, $parts), config()->integer('analytics.cache_ttl'), $callback);
    }

    /**
     * @param  array<string, mixed>  $parts
     */
    public static function key(DashboardView|string $view, User $viewer, string $block, array $parts): string
    {
        ksort($parts);

        return implode(':', [self::PREFIX, $viewer->company_id, $view instanceof DashboardView ? $view->value : $view, $viewer->id, $block, sha1((string) json_encode($parts))]);
    }

    private function store(): Repository
    {
        $store = config('analytics.cache_store');

        return Cache::store(is_string($store) && $store !== '' ? $store : null);
    }
}
