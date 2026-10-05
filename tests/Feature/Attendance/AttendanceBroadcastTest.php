<?php

use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Organization\Enums\Role;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Broadcasting\PrivateChannel;

test('the event broadcasts to the company and division channels without location data', function () {
    $division = Division::factory()->create();
    $user = User::factory()->inDivision($division)->create();
    $day = AttendanceDay::factory()->for($user)->create(['late_minutes' => 3]);
    $log = AttendanceLog::factory()->forDay($day)->create();

    $event = new AttendanceRecorded($day, $log);

    expect(array_map(fn (PrivateChannel $channel) => $channel->name, $event->broadcastOn()))
        ->toBe(['private-company.attendance', "private-division.{$division->id}.attendance"])
        ->and($event->broadcastAs())->toBe('attendance.recorded')
        ->and($event->broadcastWith())->toMatchArray([
            'user' => ['id' => $user->id, 'name' => $user->name, 'division_id' => $division->id],
            'type' => 'check_in',
            'status' => 'present',
            'late_minutes' => 3,
        ])
        ->and($event->broadcastWith())->not->toHaveKeys(['latitude', 'longitude', 'selfie_path']);
});

test('employees without a division only reach the company channel', function () {
    $day = AttendanceDay::factory()->create();
    $event = new AttendanceRecorded($day, AttendanceLog::factory()->forDay($day)->create());

    expect($event->broadcastOn())->toHaveCount(1);
});

test('channel authorization uses the attendance policy', function () {
    $this->seed(RoleSeeder::class);
    $division = Division::factory()->create();
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($division)->create();
    $hr = User::factory()->withRole(Role::Hr)->create();
    $member = User::factory()->withRole(Role::Anggota)->inDivision($division)->create();

    $channels = app(BroadcastManager::class)->connection()->getChannels();
    $company = $channels->get('company.attendance');
    $divisionChannel = $channels->get('division.{division}.attendance');

    expect($company)->toBeCallable()
        ->and($company($hr))->toBeTrue()
        ->and($company($kadiv))->toBeFalse()
        ->and($divisionChannel($kadiv, $division))->toBeTrue()
        ->and($divisionChannel($member, $division))->toBeFalse()
        ->and($divisionChannel($hr, $division))->toBeTrue();
});
