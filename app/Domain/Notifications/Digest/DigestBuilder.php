<?php

namespace App\Domain\Notifications\Digest;

use App\Domain\Notifications\Digest\Contracts\DigestSection;
use App\Domain\Notifications\Digest\Data\DailyDigest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Container\Container;
use InvalidArgumentException;

/**
 * Builds a user's daily digest from the section providers registered in
 * config/notifications.php (digest.sections).
 */
final class DigestBuilder
{
    public function __construct(private readonly Container $container) {}

    public function build(User $user, CarbonImmutable $date): DailyDigest
    {
        $sections = [];

        foreach ($this->sections() as $provider) {
            $section = $provider->build($user, $date);

            if ($section !== null && ! $section->isEmpty()) {
                $sections[] = $section;
            }
        }

        return new DailyDigest($user, $date, $sections);
    }

    /**
     * @return list<DigestSection>
     */
    private function sections(): array
    {
        /** @var list<class-string> $classes */
        $classes = config('notifications.digest.sections', []);

        return array_map(function (string $class): DigestSection {
            $provider = $this->container->make($class);

            if (! $provider instanceof DigestSection) {
                throw new InvalidArgumentException("[{$class}] must implement ".DigestSection::class.'.');
            }

            return $provider;
        }, $classes);
    }
}
