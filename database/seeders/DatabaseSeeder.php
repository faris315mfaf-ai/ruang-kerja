<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        if (app()->environment(['local', 'testing'])) {
            $this->call(DemoUserSeeder::class);
            $this->call(OrganizationSeeder::class);
            $this->call(NotificationDemoSeeder::class);
        }

        $this->call(RequestSeeder::class);
    }
}
