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
            $this->call(RoleDashboardDemoSeeder::class);
            $this->call(WorkspaceSeeder::class);
            $this->call(ProjectSeeder::class);
            $this->call(TaskCollaborationSeeder::class);
            $this->call(ChatDemoSeeder::class);
            $this->call(AutomationDemoSeeder::class);
            $this->call(NoteDemoSeeder::class);
            $this->call(MeetingDemoSeeder::class);
            $this->call(NotificationDemoSeeder::class);
            $this->call(PlannerDemoSeeder::class);
            $this->call(OkrDemoSeeder::class);
            $this->call(StaffDemoSeeder::class); // laporan harian & pengumuman (keputusan pemilik 6 Okt 2026)
            $this->call(MonitoringDemoSeeder::class);
            $this->call(AttendanceSeeder::class);
            $this->call(AnalyticsDemoSeeder::class); // APP_ENV=local only: ~50 employees × 6 months
        }

        $this->call(RequestSeeder::class);
    }
}
