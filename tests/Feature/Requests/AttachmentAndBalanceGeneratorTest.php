<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Domain\Requests\Actions\UpdateLeaveBalance;
use App\Domain\Tenancy\Scheduling\CompanySchedule;
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
        ->and($attachment->storage_path)->toStartWith('company/'.$request->company_id.'/request-attachments/'.$request->id.'/')
        ->and($attachment->size_bytes)->toBe(120 * 1024);

    Storage::disk('local')->assertExists((string) $attachment->storage_path);
    expect(config('filesystems.disks.local.root'))->toBe(storage_path('app/private'));
});

it('still serves an attachment stored before the company directory', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->sick, [
        'start_date' => '2026-10-07',
        'end_date' => '2026-10-08',
        'attachments' => [UploadedFile::fake()->create('surat dokter.pdf', 120, 'application/pdf')],
    ]);
    $attachment = $request->attachments()->sole();
    $legacy = 'request-attachments/'.$request->id.'/lama.pdf';
    Storage::disk('local')->move((string) $attachment->storage_path, $legacy);
    $attachment->forceFill(['storage_path' => $legacy])->save();

    $this->actingAs($s->employee)
        ->get(route('requests.attachment', [$request, $attachment]))
        ->assertOk();
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

    // Per company (Fase 1 multi-perusahaan): checked every five minutes, run 1 January 00.05 of each company's clock.
    $events = collect(app(Schedule::class)->events())
        ->filter(fn ($event) => $event->description === 'requests:generate-balances');
    $task = app(CompanySchedule::class)->task('requests:generate-balances');
    $newYear = CarbonImmutable::parse('2027-01-01 00:05', 'Asia/Jakarta');

    expect($events)->toHaveCount(1)
        ->and($events->first()->expression)->toBe('*/5 * * * *')
        ->and($task?->at)->toBe('00:05')
        ->and($task?->isDueAt($newYear))->toBeTrue()
        ->and($task?->isDueAt($newYear->addDay()))->toBeFalse();
});

it('fills the carry-over of a next-year balance created early, exactly once (review #4)', function () {
    $s = $this->s;
    LeaveBalance::factory()->create([
        'user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026,
        'entitled_days' => 12, 'used_days' => 4,
    ]);

    // December: a January leave creates the 2027 balance on first use (no carry-over yet).
    $this->travelTo(CarbonImmutable::parse('2026-12-10 09:00', 'Asia/Jakarta'));
    $s->submit($s->employee, $s->annual, ['start_date' => '2027-01-04', 'end_date' => '2027-01-05']);
    $early = LeaveBalance::query()->where(['user_id' => $s->employee->id, 'year' => 2027])->sole();
    expect($early->carried_over_days)->toBe(0.0)->and($early->pending_days)->toBe(2.0)->and($early->generated_at)->toBeNull();

    $this->travelTo(CarbonImmutable::parse('2027-01-01 00:05', 'Asia/Jakarta'));
    $result = app(GenerateAnnualBalances::class)->handle(2027);

    $early->refresh();
    expect($result['completed'])->toBe(1)
        ->and($early->carried_over_days)->toBe(5.0)   // 8 unused, capped at 5
        ->and($early->pending_days)->toBe(2.0)
        ->and($early->generated_at)->not->toBeNull()
        ->and(LeaveBalance::query()->where(['user_id' => $s->employee->id, 'year' => 2027])->count())->toBe(1);

    // Running again changes nothing.
    $again = app(GenerateAnnualBalances::class)->handle(2027);
    expect($again['created'] + $again['completed'])->toBe(0)
        ->and($early->refresh()->carried_over_days)->toBe(5.0);
});

it('never overwrites a carry-over HR already set (review #4)', function () {
    $s = $this->s;
    LeaveBalance::factory()->create([
        'user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026,
        'entitled_days' => 12, 'used_days' => 4,
    ]);
    $next = LeaveBalance::factory()->create(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2027, 'entitled_days' => 12]);

    app(UpdateLeaveBalance::class)->handle($s->hr, $next, 12, 1);
    app(GenerateAnnualBalances::class)->handle(2027);

    expect($next->refresh()->carried_over_days)->toBe(1.0);
});
