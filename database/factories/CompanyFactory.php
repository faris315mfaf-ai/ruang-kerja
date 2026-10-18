<?php

namespace Database\Factories;

use App\Models\Company;
use Closure;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    /** Settings key of companies built by the two-company test world. */
    public const string FOREIGN_FLAG = 'tenancy_fixture';

    /** Default company forced by within() (null = first non-foreign company). */
    private static ?string $forced = null;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'PT '.fake()->company(),
            'google_domain' => fake()->unique()->domainWord().'.test',
            'timezone' => 'Asia/Jakarta',
            'settings' => [],
        ];
    }

    /**
     * Marks a company built by the two-company test world (tests/Support/
     * tenancy-helpers.php): it never becomes the default company below.
     */
    public function foreign(): static
    {
        return $this->state(fn (): array => ['settings' => [self::FOREIGN_FLAG => 'foreign']]);
    }

    /**
     * The default company for factories of child models: the one set by
     * within(), else the first non-foreign company in the database, or a new
     * one. Phase 1 has a single company, so factories attach to it instead of
     * creating one each time.
     */
    public static function defaultId(): string
    {
        if (self::$forced !== null) {
            return self::$forced;
        }

        $id = Company::query()
            ->whereRaw("coalesce(settings->>'".self::FOREIGN_FLAG."', '') <> 'foreign'")
            ->orderBy('id')
            ->value('id');

        return is_string($id) ? $id : Company::factory()->create()->id;
    }

    /**
     * Runs $callback with $company as the default company of every factory
     * (nested factories included), then restores the previous default.
     *
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public static function within(Company $company, Closure $callback): mixed
    {
        $previous = self::$forced;
        self::$forced = $company->id;

        try {
            return $callback();
        } finally {
            self::$forced = $previous;
        }
    }
}
