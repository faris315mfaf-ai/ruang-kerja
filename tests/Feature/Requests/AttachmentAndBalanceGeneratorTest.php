<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

it('requires an attachment for sick leave longer than N days', function () {
    $s = $this->s;

    // One day: no letter needed.
    $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-05', 'end_date' => '2026-10-05']);

    expect(fn () => $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-07', 'end_date' => '2026-10-08']))
        ->toThrow(ValidationException::class, 'Sakit lebih dari 1 hari wajib melampirkan surat (mis. surat dokter).');

    // Nothing is left behind when the submission fails.
    expect(Storage::disk('local')->allFiles())->toBe([]);
});

it('stores attachments on the private disk', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->sick, [
        'start_date' => '2026-10-07',
        'end_date' => '2026-10-08',
        'attachments' => [UploadedFile::fake()->create('surat dokter.pdf', 120, 'application/pdf')],
    ]);

    $attachment = $request->attachments()->sole();

    expect($attachment->filename)->toBe('surat dokter.pdf')
        ->and($attachment->storage_path)->toStartWith('request-attachments/'.$request->id.'/')
        ->and($attachment->size_bytes)->toBe(120 * 1024);

    Storage::disk('local')->assertExists((string) $attachment->storage_path);
    expect(config('filesystems.disks.local.root'))->toBe(storage_path('app/private'));
});

it('generates yearly balances with capped carry-over, idempotently', function () {
    $s = $this->s;

    LeaveBalance::factory()->create([
        'user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026,
        'entitled_days' => 12, 'used_days' => 4,
    ]);
    LeaveBalance::factory()->create([
        'user_id' => $s->manager->id, 'leave_type_id' => $s->annual->id, 'year' => 2026,
        'entitled_days' => 12, 'used_days' => 10,
    ]);
    User::factory()->inactive()->create();

    $result = app(GenerateAnnualBalances::class)->handle(2027);
    $active = User::query()->active()->count();

    expect($result['created'])->toBe($active);

    $employee = LeaveBalance::query()->where(['user_id' => $s->employee->id, 'year' => 2027])->sole();
    $manager = LeaveBalance::query()->where(['user_id' => $s->manager->id, 'year' => 2027])->sole();
    $hr = LeaveBalance::query()->where(['user_id' => $s->hr->id, 'year' => 2027])->sole();

    expect($employee->entitled_days)->toBe(12.0)
        ->and($employee->carried_over_days)->toBe(5.0)   // 8 unused, capped at 5
        ->and($manager->carried_over_days)->toBe(2.0)
        ->and($hr->carried_over_days)->toBe(0.0);

    expect(app(GenerateAnnualBalances::class)->handle(2027)['created'])->toBe(0);
});

it('skips types without quota and ineligible employees', function () {
    $s = $this->s;
    LeaveType::factory()->create(['code' => 'CBR', 'name' => 'Cuti besar', 'annual_quota_days' => 30, 'min_service_months' => 72]);
    $veteran = User::factory()->withRole(Role::Anggota)->create(['joined_at' => '2015-01-01']);

    app(GenerateAnnualBalances::class)->handle(2027);

    expect(LeaveBalance::query()->where('year', 2027)->whereHas('leaveType', fn ($q) => $q->where('code', 'CBR'))->pluck('user_id')->all())
        ->toContain($veteran->id)
        ->not->toContain($s->employee->id);
    expect(LeaveBalance::query()->where('leave_type_id', $s->sick->id)->exists())->toBeFalse();
});

it('runs the generator from the command and schedules it on 1 January', function () {
    $this->artisan('requests:generate-balances', ['year' => 2027])
        ->expectsOutputToContain('Saldo 2027:')
        ->assertSuccessful();

    $this->artisan('requests:generate-balances', ['year' => 1900])->assertFailed();

    $events = collect(app(Schedule::class)->events())
        ->filter(fn ($event) => str_contains((string) $event->command, 'requests:generate-balances'));

    expect($events)->toHaveCount(1)
        ->and($events->first()->expression)->toBe('5 0 1 1 *')
        ->and($events->first()->timezone)->toBe('Asia/Jakarta');
});
