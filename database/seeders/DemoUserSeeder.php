<?php

namespace Database\Seeders;

use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Organization\Enums\Theme;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * One demo account per role (local/testing only, password `password`). Idempotent.
 */
class DemoUserSeeder extends Seeder
{
    public function run(): void
    {
        // Idempotent; ensures roles exist when this seeder runs on its own.
        $this->call(RoleSeeder::class, silent: true);

        foreach (DemoAccounts::all() as $account) {
            // updateOrCreate by email; forceFill because email_verified_at is not fillable.
            $user = User::query()->firstOrNew(['email' => $account->email]);

            $user->forceFill([
                'name' => $account->name,
                'password' => DemoAccounts::PASSWORD,
                'email_verified_at' => $user->email_verified_at ?? now(),
                'theme' => Theme::System,
            ])->save();

            $user->syncRoles([$account->role->value]);
        }
    }
}
