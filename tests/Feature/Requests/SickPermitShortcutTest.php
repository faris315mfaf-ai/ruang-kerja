<?php

use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\CancelRequest;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\SaveRequestDraft;
use App\Domain\Requests\Services\SickPermitShortcut;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;
use Tests\Support\RequestScenario;

/*
 * "Tidak masuk? Ajukan sakit / izin" (keputusan pemilik 14 Okt 2026):
 * `leaveShortcut` of the attendance payloads, web preview and admin form.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    F::office();
    $this->s = RequestScenario::make();
    $this->s->sick->update(['submit_cutoff_time' => '12:00', 'requires_attachment_after_days' => null]);
    $this->s->permit->update(['submit_cutoff_time' => '12:00']);
    $this->employee = $this->s->employee;
    app(GiveAttendanceConsent::class)->handle($this->employee);
    $this->at = fn (string $time, string $date = '2026-10-14') => $this->travelTo(CarbonImmutable::parse("{$date} {$time}", 'Asia/Jakarta'));
    $this->shortcut = fn () => app(SickPermitShortcut::class)->handle($this->employee, CarbonImmutable::now());
});

it('is available before the cutoff for an employee who has not checked in', function () {
    ($this->at)('09:30');

    expect(($this->shortcut)())->toMatchArray([
        'available' => true,
        'sickCutoff' => '12:00',
        'permitCutoff' => '12:00',
        'sickClosed' => false,
        'permitClosed' => false,
        'closedReason' => null,
        'pending' => null,
    ])->and(($this->shortcut)()['sickType'])->toMatchArray(['code' => 'SKT'])
        ->and(($this->shortcut)()['permitType'])->toMatchArray(['code' => 'IZN']);
});

it('closes at 12:00 with the reason, and keeps the cutoffs for the client', function () {
    ($this->at)('11:59');
    expect(($this->shortcut)()['available'])->toBeTrue();

    ($this->at)('12:00');
    expect(($this->shortcut)())->toMatchArray([
        'available' => false,
        'sickClosed' => true,
        'permitClosed' => true,
        'sickCutoff' => '12:00',
        'closedReason' => 'Batas pengajuan sakit/izin pukul 12.00 sudah lewat.',
        'pending' => null,
    ]);
});

it('stays available for the type whose cutoff has not passed yet', function () {
    $this->s->permit->update(['submit_cutoff_time' => '14:00']);
    ($this->at)('13:00');

    expect(($this->shortcut)())->toMatchArray(['available' => true, 'sickClosed' => true, 'permitClosed' => false, 'permitCutoff' => '14:00']);

    ($this->at)('14:30');
    expect(($this->shortcut)())->toMatchArray([
        'available' => false,
        'closedReason' => 'Batas pengajuan sakit pukul 12.00 dan izin pukul 14.00 sudah lewat.',
    ]);
});

it('stays available all day when the types have no cutoff', function () {
    $this->s->sick->update(['submit_cutoff_time' => null]);
    $this->s->permit->update(['submit_cutoff_time' => null]);
    ($this->at)('17:30');

    expect(($this->shortcut)())->toMatchArray(['available' => true, 'sickCutoff' => null, 'permitCutoff' => null, 'closedReason' => null]);
});

it('is unavailable once the employee has checked in', function () {
    ($this->at)('08:00');
    AttendanceDay::factory()->for($this->employee)->on('2026-10-14')->create([
        'status' => AttendanceStatus::Present,
        'check_in_at' => CarbonImmutable::parse('2026-10-14 07:55', 'Asia/Jakarta')->utc(),
    ]);

    expect(($this->shortcut)())->toMatchArray(['available' => false, 'closedReason' => null, 'pending' => null]);
});

it('is unavailable with an approved full-day request but allowed with an approved half day or hours', function () {
    ($this->at)('08:00');
    $sick = $this->s->submit($this->employee, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']);
    $this->s->approve($this->s->hr, $this->s->approve($this->s->manager, $sick));
    expect(($this->shortcut)())->toMatchArray(['available' => false, 'pending' => null]);

    EmployeeRequest::query()->delete();
    AttendanceDay::query()->delete();
    $hours = $this->s->submit($this->employee, $this->s->permit, ['date' => '2026-10-14', 'start_time' => '15:00', 'end_time' => '17:00']);
    $this->s->approve($this->s->hr, $this->s->approve($this->s->manager, $hours));
    expect(($this->shortcut)()['available'])->toBeTrue();
});

it('reports a waiting request instead, also after the cutoff, and frees up again when rejected or canceled', function () {
    ($this->at)('08:00');
    $request = $this->s->submit($this->employee, $this->s->sick, ['start_date' => '2026-10-14', 'end_date' => '2026-10-15']);

    expect(($this->shortcut)())->toMatchArray([
        'available' => false,
        'closedReason' => null,
        'pending' => ['id' => $request->id, 'number' => $request->number, 'typeLabel' => 'Sakit', 'status' => 'pending', 'statusLabel' => 'Menunggu'],
    ]);

    ($this->at)('14:00');
    expect(($this->shortcut)())->toMatchArray(['available' => false, 'closedReason' => null])
        ->and(($this->shortcut)()['pending']['id'])->toBe($request->id);

    app(RejectStep::class)->handle($this->s->manager, $request, 'Belum ada bukti.');
    expect(($this->shortcut)())->toMatchArray(['available' => false, 'pending' => null])
        ->and(($this->shortcut)()['closedReason'])->toBe('Batas pengajuan sakit/izin pukul 12.00 sudah lewat.');

    ($this->at)('08:10');
    $again = $this->s->submit($this->employee, $this->s->permit, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']);
    expect(($this->shortcut)()['pending']['typeLabel'])->toBe('Izin');
    app(CancelRequest::class)->handle($this->employee, $again);
    expect(($this->shortcut)())->toMatchArray(['available' => true, 'pending' => null]);
});

it('does not count a request of another day or a draft', function () {
    ($this->at)('08:00');
    $this->s->submit($this->employee, $this->s->sick, ['start_date' => '2026-10-16', 'end_date' => '2026-10-16']);
    app(SaveRequestDraft::class)->handle($this->employee, RequestScenario::input($this->s->permit, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']));

    expect(($this->shortcut)())->toMatchArray(['available' => true, 'pending' => null]);
});

it('is unavailable on a day off or holiday, and without a sick or izin type', function () {
    ($this->at)('09:00', '2026-10-17'); // Saturday
    expect(($this->shortcut)())->toMatchArray(['available' => false, 'closedReason' => null]);

    Holiday::factory()->on('2026-10-14', 'Libur perusahaan')->create(['company_id' => $this->employee->company_id]);
    ($this->at)('09:00');
    expect(($this->shortcut)()['available'])->toBeFalse();

    Holiday::query()->delete();
    LeaveType::query()->whereIn('category', ['sick', 'permit'])->delete();
    expect(($this->shortcut)())->toMatchArray(['available' => false, 'sickType' => null, 'permitType' => null, 'closedReason' => null]);
});

it('skips locked types', function () {
    $this->s->permit->update(['locked_reason' => 'Dikunci.']);
    ($this->at)('09:00');

    expect(($this->shortcut)())->toMatchArray(['available' => true, 'permitType' => null, 'permitCutoff' => null]);
});

it('ships in the web Absensi page props and never when an open day waits for check-out', function () {
    ($this->at)('09:30');

    $this->actingAs($this->employee)->get(route('attendance.index'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('today.leaveShortcut.available', true)
            ->where('today.leaveShortcut.sickCutoff', '12:00')
            ->where('today.leaveShortcut.pending', null));

    AttendanceDay::factory()->for($this->employee)->on('2026-10-14')->create([
        'status' => AttendanceStatus::Present,
        'check_in_at' => CarbonImmutable::parse('2026-10-14 08:00', 'Asia/Jakarta')->utc(),
    ]);
    expect(app(MyAttendance::class)->today($this->employee, CarbonImmutable::now())['leaveShortcut'])->toMatchArray(['available' => false, 'sickType' => null]);
});

it('rides in the API state of hari-ini and follows the clock', function () {
    ($this->at)('11:50');
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $this->employee->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => str_repeat('ab', 32), 'name' => 'Pixel 8'],
    ])->json('token');

    $open = $this->withToken($token)->getJson('/api/v1/absensi/hari-ini')->assertOk();
    $open->assertJsonPath('state.leaveShortcut.available', true)
        ->assertJsonPath('state.leaveShortcut.sickCutoff', '12:00')
        ->assertJsonPath('state.leaveShortcut.permitCutoff', '12:00')
        ->assertJsonPath('state.leaveShortcut.closedReason', null)
        ->assertJsonPath('state.leaveShortcut.pending', null)
        ->assertJsonPath('today.leaveShortcut.available', true)
        // Neighbouring state fields stay (W2 windows, center).
        ->assertJsonStructure(['state' => ['windows', 'center', 'canCheckIn', 'code']]);

    ($this->at)('12:05');
    $closed = $this->withToken($token)->getJson('/api/v1/absensi/hari-ini')->assertOk();
    $closed->assertJsonPath('state.leaveShortcut.available', false)
        ->assertJsonPath('state.leaveShortcut.closedReason', 'Batas pengajuan sakit/izin pukul 12.00 sudah lewat.');
});

it('puts the cutoff hints on the types of GET /pengajuan/jenis and rejects late submits with a 422', function () {
    ($this->at)('09:00');
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $this->employee->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => str_repeat('cd', 32), 'name' => 'Pixel 8'],
    ])->json('token');

    $types = fn () => collect($this->withToken($token)->getJson('/api/v1/pengajuan/jenis')->assertOk()->json('categories'))->flatMap(fn (array $c) => $c['types'])->keyBy('code');

    expect($types()['SKT'])->toMatchArray(['submit_cutoff_time' => '12:00', 'submit_cutoff_label' => 'Batas pengajuan hari ini pukul 12.00', 'submit_closed_today' => false])
        ->and($types()['CUT'])->toMatchArray(['submit_cutoff_time' => null, 'submit_closed_today' => false]);

    ($this->at)('12:20');
    expect($types()['SKT']['submit_closed_today'])->toBeTrue()->and($types()['IZN']['submit_closed_today'])->toBeTrue();

    $this->withToken($token)->postJson('/api/v1/pengajuan', [
        'type' => $this->s->sick->id, 'reason' => 'Demam.', 'start_date' => '2026-10-14', 'end_date' => '2026-10-14',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.start_date.0', 'Batas pengajuan sakit untuk hari ini pukul 12.00 sudah lewat. Hari ini tercatat alpha bila Anda tidak absen.');

    $this->withToken($token)->postJson('/api/v1/pengajuan', [
        'type' => $this->s->sick->id, 'reason' => 'Demam.', 'start_date' => '2026-10-15', 'end_date' => '2026-10-15',
    ])->assertCreated();
});

it('shows the same message in the web live preview so the form can block sending', function () {
    ($this->at)('13:00');
    $query = ['leave_type_id' => $this->s->sick->id, 'start_date' => '2026-10-14', 'end_date' => '2026-10-14'];

    $this->actingAs($this->employee)->getJson('/pengajuan/pratinjau?'.http_build_query($query))->assertOk()
        ->assertJsonPath('errors.start_date', 'Batas pengajuan sakit untuk hari ini pukul 12.00 sudah lewat. Hari ini tercatat alpha bila Anda tidak absen.');

    $this->actingAs($this->employee)->getJson('/pengajuan/pratinjau?'.http_build_query([...$query, 'start_date' => '2026-10-15', 'end_date' => '2026-10-15']))->assertOk()
        ->assertJsonPath('errors', null);
});

it('lets HR change or clear the cutoff in the admin form, validates it and keeps staff out', function () {
    $hr = $this->s->hr;
    $payload = fn (array $extra = []) => ['code' => 'SKT', 'name' => 'Sakit', 'category' => 'sick', ...$extra];

    $this->actingAs($hr)->put("/admin/pengajuan/jenis/{$this->s->sick->id}", $payload(['submit_cutoff_time' => '10:30']))->assertSessionHasNoErrors();
    expect($this->s->sick->refresh()->submit_cutoff_time)->toBe('10:30');

    // The form omits the field: stays as it is.
    $this->actingAs($hr)->put("/admin/pengajuan/jenis/{$this->s->sick->id}", $payload())->assertSessionHasNoErrors();
    expect($this->s->sick->refresh()->submit_cutoff_time)->toBe('10:30');

    $this->actingAs($hr)->put("/admin/pengajuan/jenis/{$this->s->sick->id}", $payload(['submit_cutoff_time' => null]))->assertSessionHasNoErrors();
    expect($this->s->sick->refresh()->submit_cutoff_time)->toBeNull();

    foreach (['25:00', '9:5', '12.00', 'noon'] as $bad) {
        $this->actingAs($hr)->put("/admin/pengajuan/jenis/{$this->s->sick->id}", $payload(['submit_cutoff_time' => $bad]))
            ->assertSessionHasErrors(['submit_cutoff_time' => 'Isi jam dengan format JJ:MM, mis. 12:00.']);
    }

    // Only sakit and izin keep a cutoff.
    $this->actingAs($hr)->put("/admin/pengajuan/jenis/{$this->s->overtime->id}", ['code' => 'LBR', 'name' => 'Lembur', 'category' => 'overtime', 'submit_cutoff_time' => '12:00'])
        ->assertSessionHasNoErrors();
    expect($this->s->overtime->refresh()->submit_cutoff_time)->toBeNull();

    $this->actingAs($this->s->hr)->get('/admin/pengajuan')->assertInertia(fn (Assert $page) => $page
        ->where('types', fn ($types) => collect($types)->contains(fn ($type) => $type['code'] === 'IZN' && $type['submit_cutoff_time'] === '12:00')));

    foreach ([Role::Anggota, Role::KepalaDivisi, Role::Direksi] as $role) {
        $this->actingAs(User::factory()->withRole($role)->create())
            ->put("/admin/pengajuan/jenis/{$this->s->sick->id}", $payload(['submit_cutoff_time' => '08:00']))->assertForbidden();
    }

    expect($this->s->sick->refresh()->submit_cutoff_time)->toBeNull();
});

it('migrates the cutoff to existing sick and izin types only', function () {
    $migration = require base_path('database/migrations/2026_10_20_100000_add_submit_cutoff_time_to_leave_types.php');
    $migration->down();
    $migration->up();

    expect(LeaveType::query()->where('category', 'sick')->value('submit_cutoff_time'))->toBe('12:00')
        ->and(LeaveType::query()->where('category', 'permit')->value('submit_cutoff_time'))->toBe('12:00')
        ->and(LeaveType::query()->whereNotIn('category', ['sick', 'permit'])->whereNotNull('submit_cutoff_time')->count())->toBe(0);
});

it('opens the request form pre-selected from the shortcut deep link', function () {
    ($this->at)('09:00');

    $this->actingAs($this->employee)->get('/pengajuan/baru?jenis=SKT&tanggal=2026-10-14')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('requests/form')
            ->where('initial.category', 'sick')
            ->where('initial.leave_type_id', $this->s->sick->id)
            ->where('initial.start_date', '2026-10-14')
            ->where('initial.end_date', '2026-10-14')
            ->where('initial.date', '2026-10-14')
            ->where('initial.from_link', true));

    // Izin by lowercase code; a bad date or unknown type falls back to the plain form.
    $this->actingAs($this->employee)->get('/pengajuan/baru?jenis=izn&tanggal=nope')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('initial.category', 'permit')
            ->where('initial.leave_type_id', $this->s->permit->id)
            ->missing('initial.start_date'));

    $this->actingAs($this->employee)->get('/pengajuan/baru?jenis=XXX&tanggal=2026-10-14')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->missing('initial.leave_type_id')->missing('initial.from_link'));

    // A locked type is not preselected.
    $this->s->permit->update(['locked_reason' => 'Dikunci.']);
    $this->actingAs($this->employee)->get('/pengajuan/baru?jenis=IZN')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->missing('initial.from_link'));

    // The form props carry the cutoff hints of each type.
    $this->actingAs($this->employee)->get('/pengajuan/baru?kategori=sakit')->assertInertia(fn (Assert $page) => $page
        ->where('categories', fn ($categories) => collect($categories)->flatMap(fn ($c) => $c['types'])
            ->contains(fn ($t) => $t['code'] === 'SKT' && $t['submit_cutoff_label'] === 'Batas pengajuan hari ini pukul 12.00' && $t['submit_closed_today'] === false)));
});
