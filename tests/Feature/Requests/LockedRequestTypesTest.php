<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

/*
 * Keputusan pemilik 6 Okt 2026: cuti & lembur are locked until the SOP
 * exists. Locked types stay visible (lock tile), cannot be drafted or sent;
 * requests already sent or approved are untouched; HR can lock/unlock.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

function lockSop(LeaveType ...$types): void
{
    foreach ($types as $type) {
        $type->update(['locked_reason' => LeaveType::SOP_LOCK_REASON]);
    }
}

it('shows locked types as locked in the form and opens on an open category', function () {
    $s = $this->s;
    lockSop($s->annual, $s->overtime);

    $this->actingAs($s->employee)->get('/pengajuan/baru?kategori=cuti')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('initial.category', 'permit')
            ->where('categories.0.value', 'leave')
            ->where('categories.0.types.0.locked', true)
            ->where('categories.0.types.0.locked_reason', LeaveType::SOP_LOCK_REASON)
            ->where('categories.1.types.0.locked', false));

    // An open category asked for is kept.
    $this->actingAs($s->employee)->get('/pengajuan/baru?kategori=sakit')
        ->assertInertia(fn (Assert $page) => $page->where('initial.category', 'sick'));
});

it('refuses to draft, send or preview a locked type with a clear message', function () {
    $s = $this->s;
    lockSop($s->annual, $s->overtime);
    $message = 'Cuti tahunan belum bisa diajukan. '.LeaveType::SOP_LOCK_REASON;

    $this->actingAs($s->employee)->post('/pengajuan', [
        'intent' => 'submit', 'leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'reason' => 'Acara keluarga.',
    ])->assertSessionHasErrors(['leave_type_id' => $message]);

    $this->actingAs($s->employee)->post('/pengajuan', [
        'intent' => 'draft', 'leave_type_id' => $s->overtime->id, 'date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '19:00', 'reason' => 'Stok.',
    ])->assertSessionHasErrors('leave_type_id');

    $this->actingAs($s->employee)
        ->getJson('/pengajuan/pratinjau?'.http_build_query(['leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-12']))
        ->assertOk()
        ->assertJsonPath('errors.leave_type_id', $message);

    expect(EmployeeRequest::query()->count())->toBe(0)
        ->and(fn () => $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '19:00']))
        ->toThrow(ValidationException::class);
});

it('does not let an old draft of a locked type be sent, but it can still be canceled', function () {
    $s = $this->s;
    $this->actingAs($s->employee)->post('/pengajuan', [
        'intent' => 'draft', 'leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'reason' => 'Acara keluarga.',
    ])->assertSessionHasNoErrors();
    $draft = EmployeeRequest::query()->sole();
    lockSop($s->annual);

    $this->actingAs($s->employee)->post("/pengajuan/{$draft->id}", [
        'intent' => 'submit', 'leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'reason' => 'Acara keluarga.',
    ])->assertSessionHasErrors('leave_type_id');

    expect($draft->refresh()->status)->toBe(RequestStatus::Draft)->and($draft->number)->toBeNull();

    $this->actingAs($s->employee)->get("/pengajuan/{$draft->id}/ubah")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('request.type.locked', true));

    $this->actingAs($s->employee)->post("/pengajuan/{$draft->id}/batal")->assertRedirect();
    expect($draft->refresh()->status)->toBe(RequestStatus::Canceled);
});

it('leaves requests sent before the lock untouched', function () {
    $s = $this->s;
    $approved = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $approved = $s->approve($s->hr, $s->approve($s->manager, $approved));
    $pending = $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '19:00']);
    lockSop($s->annual, $s->overtime);

    expect($approved->refresh()->status)->toBe(RequestStatus::Approved);

    // A pending request still runs through its flow.
    $pending = $s->approve($s->hr, $s->approve($s->manager, $pending));
    expect($pending->status)->toBe(RequestStatus::Approved);
});

it('lets HR lock and unlock a type, with the SOP reason as default', function () {
    $s = $this->s;
    $fields = ['code' => 'CUT', 'name' => 'Cuti tahunan', 'category' => 'leave', 'annual_quota_days' => 12];

    $this->actingAs($s->hr)->put("/admin/pengajuan/jenis/{$s->annual->id}", [...$fields, 'is_locked' => true, 'locked_reason' => ''])
        ->assertSessionHasNoErrors();
    expect($s->annual->refresh()->locked_reason)->toBe(LeaveType::SOP_LOCK_REASON)
        ->and(AuditLog::query()->where('action', 'leave_type.updated')->exists())->toBeTrue();

    // Saving without the lock fields keeps the lock.
    $this->actingAs($s->hr)->put("/admin/pengajuan/jenis/{$s->annual->id}", $fields)->assertSessionHasNoErrors();
    expect($s->annual->refresh()->isLocked())->toBeTrue();

    $this->actingAs($s->hr)->get('/admin/pengajuan')
        ->assertInertia(fn (Assert $page) => $page->where('types', fn ($types) => collect($types)->firstWhere('code', 'CUT')['locked_reason'] === LeaveType::SOP_LOCK_REASON));

    $this->actingAs($s->hr)->put("/admin/pengajuan/jenis/{$s->annual->id}", [...$fields, 'is_locked' => false])
        ->assertSessionHasNoErrors();
    expect($s->annual->refresh()->locked_reason)->toBeNull();

    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    expect($request->status)->toBe(RequestStatus::Pending);
});

it('only lets HR and Super Admin change the lock', function (Role $role, bool $allowed) {
    $user = User::factory()->withRole($role)->create();

    $response = $this->actingAs($user)->put("/admin/pengajuan/jenis/{$this->s->annual->id}", [
        'code' => 'CUT', 'name' => 'Cuti tahunan', 'category' => 'leave', 'is_locked' => true,
    ]);

    $allowed ? $response->assertSessionHasNoErrors() : $response->assertForbidden();
    expect($this->s->annual->refresh()->isLocked())->toBe($allowed);
})->with([
    'super_admin' => [Role::SuperAdmin, true],
    'hr' => [Role::Hr, true],
    'direksi' => [Role::Direksi, false],
    'kepala_divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);
