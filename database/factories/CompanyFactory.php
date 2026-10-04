<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
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
     * The first company in the database, or a new one. Phase 1 has a single company,
     * so factories of child models attach to it instead of creating one each time.
     */
    public static function defaultId(): string
    {
        $id = Company::query()->orderBy('id')->value('id');

        return is_string($id) ? $id : Company::factory()->create()->id;
    }
}
