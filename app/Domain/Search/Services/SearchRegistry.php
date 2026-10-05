<?php

namespace App\Domain\Search\Services;

use App\Domain\Search\Contracts\SearchProvider;
use Illuminate\Contracts\Container\Container;
use InvalidArgumentException;

/**
 * Resolves the providers listed in config/search.php (order = group order).
 */
final class SearchRegistry
{
    public function __construct(private readonly Container $container) {}

    /**
     * @return list<SearchProvider>
     */
    public function all(): array
    {
        /** @var list<class-string> $classes */
        $classes = config('search.providers', []);

        return array_map(function (string $class): SearchProvider {
            $provider = $this->container->make($class);

            if (! $provider instanceof SearchProvider) {
                throw new InvalidArgumentException("[{$class}] must implement ".SearchProvider::class.'.');
            }

            return $provider;
        }, $classes);
    }

    /**
     * @return list<string>
     */
    public function keys(): array
    {
        return array_map(fn (SearchProvider $provider): string => $provider->key(), $this->all());
    }
}
