<?php

use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    F::office();

    $this->division = Division::factory()->create();
    $this->manager = User::factory()->withRole(Role::KepalaDivisi)->inDivision($this->division)->create();
    $this->division->update(['head_user_id' => $this->manager->id]);
    $this->employee = F::employee();
    $this->employee->update(['manager_id' => $this->manager->id, 'division_id' => $this->division->id]);

    $this->travelTo(F::at('2026-10-05 07:52'));
    $this->url = (string) F::checkIn($this->employee)->assertCreated()->json('result.selfieUrl');
    $this->log = AttendanceLog::query()->sole();
    $this->flushHeaders();
});

test('the selfie is stored privately and only served through the signed route', function () {
    expect($this->url)->toContain('signature=')->toContain('expires=')
        ->and($this->log->selfie_path)->not->toBeNull();

    $this->actingAs($this->employee)->get($this->url)
        ->assertOk()
        ->assertHeader('Cache-Control', 'max-age=0, no-store, private');
});

test('the selfie cannot be accessed without a signed URL', function () {
    $unsigned = route('attendance.selfie', $this->log);

    $this->actingAs($this->employee)->get($unsigned)->assertForbidden();
    $this->actingAs($this->employee)->get($this->url.'x')->assertForbidden();

    Auth::logout();
    $this->get($this->url)->assertRedirect(route('login'));
});

test('signed selfie URLs expire after five minutes', function () {
    $this->travel(4)->minutes();
    $this->actingAs($this->employee)->get($this->url)->assertOk();

    $this->travel(2)->minutes();
    $this->actingAs($this->employee)->get($this->url)->assertForbidden();
});

test('HR and the direct manager may view it with a signed URL, which is audited', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $url = app(SelfieStorage::class)->temporaryUrl($this->log);

    $this->actingAs($hr)->get((string) $url)->assertOk();
    $this->actingAs($this->manager)->get((string) $url)->assertOk();

    expect(AuditLog::query()->where('action', 'selfie.viewed')->pluck('user_id')->sort()->values()->all())
        ->toBe(collect([$hr->id, $this->manager->id])->sort()->values()->all());
});

test('nobody else may view it, even with a valid signature', function (Role $role) {
    $other = User::factory()->withRole($role)->create();
    $url = (string) app(SelfieStorage::class)->temporaryUrl($this->log);

    $this->actingAs($other)->get($url)->assertForbidden();
})->with([Role::SuperAdmin, Role::Direksi, Role::KepalaDivisi, Role::Anggota]);

test('there is no public path to the selfie disk', function () {
    foreach (['/storage/'.$this->log->selfie_path, '/storage/selfies/'.$this->log->selfie_path] as $path) {
        expect($this->actingAs($this->employee)->get($path)->status())->toBeIn([403, 404]);
    }
});
