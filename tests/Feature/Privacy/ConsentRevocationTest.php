<?php

use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Notifications\ConsentRevokedNotification;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;

/*
 * Withdrawing location + selfie consent (Data Saya or Absensi): GPS/selfie
 * check-in is disabled and HR of the same company is notified.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('selfies');
    $this->travelTo(F::at('2026-10-05 07:50'));
    F::office();
    $this->employee = F::employee();
    $this->hr = User::factory()->withRole(Role::Hr)->create();
    $this->otherHr = User::factory()->withRole(Role::Hr)->create(['status' => UserStatus::Inactive]);
    $this->foreignHr = User::factory()->withRole(Role::Hr)->forCompany(Company::factory()->create())->create();
});

it('revokes consent from Data Saya, disables GPS check-in and notifies HR of the company', function () {
    Notification::fake();
    expect(AttendanceConsent::hasCurrentConsent($this->employee))->toBeTrue();

    $this->actingAs($this->employee)->from('/privasi')
        ->delete(route('attendance.consent.destroy'))
        ->assertRedirect('/privasi');

    expect(AttendanceConsent::hasCurrentConsent($this->employee))->toBeFalse();

    Notification::assertSentTo($this->hr, ConsentRevokedNotification::class, fn (ConsentRevokedNotification $notification): bool => $notification->employee->is($this->employee));
    Notification::assertNotSentTo([$this->otherHr, $this->foreignHr, $this->employee], ConsentRevokedNotification::class);

    // GPS + selfie check-in is refused until consent is given again.
    F::checkIn($this->employee)->assertUnprocessable()->assertJsonPath('reason', 'consent_required');

    $this->actingAs($this->employee)->get('/privasi')->assertInertia(fn (Assert $page) => $page
        ->where('consent.granted', false)
        ->where('consent.needs_renewal', false));

    // Giving consent again re-enables it.
    $this->actingAs($this->employee)->post(route('attendance.consent.store'))->assertRedirect();
    F::checkIn($this->employee)->assertCreated();
});

it('does not notify again when there is nothing left to revoke', function () {
    Notification::fake();

    $this->actingAs($this->employee)->delete(route('attendance.consent.destroy'));
    $this->actingAs($this->employee)->delete(route('attendance.consent.destroy'));

    Notification::assertSentToTimes($this->hr, ConsentRevokedNotification::class, 1);
});

it('lands in the HR Inbox with a link to the attendance board', function () {
    $this->actingAs($this->employee)->delete(route('attendance.consent.destroy'));

    $notification = $this->hr->notifications()->sole();

    expect($notification->type)->toBe(NotificationType::ConsentRevoked->value)
        ->and($notification->data['title'])->toBe("{$this->employee->name} mencabut persetujuan data lokasi & selfie")
        ->and($notification->data['url'])->toBe('/absensi/hari-ini')
        ->and($notification->data['actor']['id'])->toBe($this->employee->id);
});
