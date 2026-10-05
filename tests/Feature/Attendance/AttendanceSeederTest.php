<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Models\User;
use Database\Seeders\AttendanceSeeder;
use Database\Seeders\DemoUserSeeder;
use Database\Seeders\OrganizationSeeder;
use Tests\Support\AttendanceFixtures as F;

test('the attendance demo data is consistent and idempotent', function () {
    $this->travelTo(F::at('2026-10-05 07:30'));
    $this->seed([DemoUserSeeder::class, OrganizationSeeder::class, AttendanceSeeder::class]);
    $counts = [AttendanceDay::query()->count(), ShiftAssignment::query()->count(), Holiday::query()->count()];

    $this->seed(AttendanceSeeder::class);

    expect([AttendanceDay::query()->count(), ShiftAssignment::query()->count(), Holiday::query()->count()])->toBe($counts)
        ->and(OfficeLocation::query()->pluck('name')->sort()->values()->all())->toBe(['Gudang Cikarang', 'Kantor Pusat'])
        ->and(Shift::query()->where('name', 'Gudang Malam')->value('crosses_midnight'))->toBeTrue();

    $rizky = User::query()->where('email', 'anggota@demo.test')->firstOrFail();
    $hana = User::query()->where('email', 'hr@demo.test')->firstOrFail();
    $hendra = User::query()->where('email', 'direksi@demo.test')->firstOrFail();

    expect(AttendanceConsent::hasCurrentConsent($rizky))->toBeFalse()
        ->and(AttendanceConsent::hasCurrentConsent($hana))->toBeTrue()
        ->and(app(ScheduleResolver::class)->forDate($rizky, F::at('2026-10-05'))->shift?->name)->toBe('Reguler')
        ->and(app(ScheduleResolver::class)->forDate($hendra, F::at('2026-10-05'))->isWorkday())->toBeFalse()
        ->and(AttendanceDay::query()->where('user_id', $rizky->id)->whereDate('work_date', '2026-10-05')->exists())->toBeFalse()
        ->and(AttendanceDay::query()->where('user_id', $rizky->id)->count())->toBeGreaterThan(15)
        ->and(AttendanceDay::query()->where('status', AttendanceStatus::Holiday)->whereDate('work_date', '2026-09-25')->exists())->toBeTrue();
});
