<?php

use App\Domain\Attendance\Enums\ConsentType;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Models\AuditLog;
use App\Models\User;

test('consent is recorded for location and selfie with the current version, idempotently', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('attendance.consent.store'))->assertRedirect();
    $this->actingAs($user)->post(route('attendance.consent.store'))->assertRedirect();

    $consents = AttendanceConsent::query()->where('user_id', $user->id)->get();

    expect($consents)->toHaveCount(2)
        ->and($consents->pluck('type')->all())->toEqualCanonicalizing([ConsentType::Location, ConsentType::Selfie])
        ->and($consents->pluck('version')->unique()->all())->toBe([config('attendance.consent.version')])
        ->and(AttendanceConsent::hasCurrentConsent($user))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'attendance.consent_granted')->count())->toBe(1);
});

test('a new policy version requires consent again', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('attendance.consent.store'));

    config(['attendance.consent.version' => '9.0']);

    expect(AttendanceConsent::hasCurrentConsent($user))->toBeFalse();

    $this->actingAs($user)->post(route('attendance.consent.store'));

    expect(AttendanceConsent::hasCurrentConsent($user))->toBeTrue()
        ->and(AttendanceConsent::query()->where('user_id', $user->id)->count())->toBe(4);
});

test('consent can be withdrawn', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('attendance.consent.store'));

    $this->actingAs($user)->delete(route('attendance.consent.destroy'))->assertRedirect();

    expect(AttendanceConsent::hasCurrentConsent($user))->toBeFalse()
        ->and(AttendanceConsent::query()->whereNull('revoked_at')->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'attendance.consent_revoked')->exists())->toBeTrue();
});

test('only one of the two consents is not enough', function () {
    $user = User::factory()->create();
    AttendanceConsent::factory()->for($user)->create(['type' => ConsentType::Location]);

    expect(AttendanceConsent::hasCurrentConsent($user))->toBeFalse();
});

test('the privacy policy page shows the version', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('attendance.policy'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('attendance/privacy-policy')->where('version', config('attendance.consent.version'))->where('retentionMonths', 12));
});
