<?php

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Jobs\ExpirePasswordResetRequests;
use App\Domain\Auth\Notifications\PasswordResetRequestedNotification;
use App\Domain\Auth\Services\PasswordResetExpiry;
use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\InboxNotification;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-06 09:00', 'Asia/Jakarta'));

    $company = Company::factory()->create();
    $this->hr = User::factory()->forCompany($company)->withRole(Role::Hr)->create();
    $this->employee = User::factory()->forCompany($company)->withRole(Role::Anggota)->create();
});

function makeResetRequest(User $user, array $attributes = []): PasswordResetRequest
{
    return PasswordResetRequest::query()->create([
        'company_id' => $user->company_id,
        'user_id' => $user->id,
        'email' => $user->email,
        'request_token_hash' => hash('sha256', Str::random()),
        'expires_at' => now()->addDay(),
        ...$attributes,
    ]);
}

it('expires pending requests after 24 hours and resolves HR\'s "Perlu tindakan" item', function () {
    $request = makeResetRequest($this->employee);
    $this->hr->notify(new PasswordResetRequestedNotification($request, $this->employee));

    $this->travel(23)->hours();
    (new ExpirePasswordResetRequests)->handle(app(PasswordResetExpiry::class));
    expect($request->refresh()->status)->toBe(PasswordResetStatus::Pending);

    $this->travel(2)->hours();
    dispatch_sync(new ExpirePasswordResetRequests);

    expect($request->refresh()->status)->toBe(PasswordResetStatus::Expired)
        ->and(InboxNotification::query()->where('subject_id', $request->id)->sole()->resolved_at)->not->toBeNull();
});

it('expires approved requests 30 minutes after the approval when unused', function () {
    $request = makeResetRequest($this->employee, [
        'status' => PasswordResetStatus::Approved,
        'decided_by' => $this->hr->id,
        'decided_at' => now(),
        'setup_token_hash' => hash('sha256', 'setup'),
    ]);

    $this->travel(29)->minutes();
    dispatch_sync(new ExpirePasswordResetRequests);
    expect($request->refresh()->status)->toBe(PasswordResetStatus::Approved);

    $this->travel(2)->minutes();
    dispatch_sync(new ExpirePasswordResetRequests);
    expect($request->refresh()->status)->toBe(PasswordResetStatus::Expired)
        ->and($request->setup_token_hash)->toBeNull();
});

it('deletes closed requests after 90 days and keeps open ones', function () {
    $old = makeResetRequest($this->employee, ['status' => PasswordResetStatus::Used]);
    $this->travel(91)->days();
    $recent = makeResetRequest($this->hr, ['status' => PasswordResetStatus::Rejected, 'reject_reason' => 'Tidak dikenal']);

    dispatch_sync(new ExpirePasswordResetRequests);

    expect(PasswordResetRequest::query()->find($old->id))->toBeNull()
        ->and(PasswordResetRequest::query()->find($recent->id))->not->toBeNull();
});

it('is scheduled hourly', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains((string) $event->description, ExpirePasswordResetRequests::class));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 * * * *');
});

it('stops a queued notification for a request that is no longer pending', function () {
    $request = makeResetRequest($this->employee, ['status' => PasswordResetStatus::Canceled]);
    $notification = new PasswordResetRequestedNotification($request, $this->employee);

    expect($notification->shouldSend($this->hr, 'mail'))->toBeFalse();

    $pending = makeResetRequest($this->hr);
    expect((new PasswordResetRequestedNotification($pending, $this->hr))->shouldSend($this->hr, 'mail'))->toBeFalse();
});
