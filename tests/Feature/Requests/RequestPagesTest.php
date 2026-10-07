<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

/** The scenario employee holds only `anggota` (staf); balances are shown to everyone else. */
function notStaff(User $user): User
{
    $user->assignRole(Role::KepalaDivisi->value);

    return $user->refresh();
}

it('shows "Pengajuan saya" with balances, counts and the selected detail', function () {
    $s = $this->s;
    notStaff($s->employee);
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);
    $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '20:00']);

    $this->actingAs($s->employee)
        ->get('/pengajuan?pilih='.$request->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('requests/index')
            ->where('counts.semua', 2)
            ->where('counts.menunggu', 2)
            ->has('requests', 2)
            ->where('balances.0.kind', 'balance')
            ->where('balances.0.balance.remaining', 12)
            ->where('balances.0.balance.pending', 3)
            ->where('balances.0.pending_request.id', $request->id)
            ->where('selected.can.cancel', true)
            ->where('selected.can.decide', false)
            ->has('selected.timeline', 2)
            ->where('selected.balance.before', 12)
            ->where('selected.balance.after', 9),
        );

    $this->actingAs($s->employee)
        ->get('/pengajuan?status=disetujui')
        ->assertInertia(fn (Assert $page) => $page->where('filter', 'disetujui')->has('requests', 0));
});

it('renders the form with categories, balance and substitutes', function () {
    $s = $this->s;
    notStaff($s->employee);

    $this->actingAs($s->employee)
        ->get('/pengajuan/baru?kategori=lembur')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('requests/form')
            ->where('initial.category', 'overtime')
            ->has('categories', 7)
            ->where('categories.0.types.0.balance.available', 12)
            ->where('substitutes', fn ($people) => collect($people)->pluck('id')->contains($s->manager->id)),
        );
});

it('never sends the annual leave balance to staff (keputusan pemilik 6 Okt 2026)', function () {
    $s = $this->s;
    expect($s->employee->isStaffOnly())->toBeTrue();
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);

    $this->actingAs($s->employee)->get('/pengajuan?pilih='.$request->id)
        ->assertInertia(fn (Assert $page) => $page
            ->where('balances', [])
            ->where('selected.balance', null));

    $this->actingAs($s->employee)->get('/pengajuan/baru')
        ->assertInertia(fn (Assert $page) => $page
            ->where('categories.0.types.0.balance', null));

    $this->actingAs($s->employee)->get("/pengajuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page->where('request.balance', null));

    $this->actingAs($s->employee)
        ->getJson('/pengajuan/pratinjau?'.http_build_query(['leave_type_id' => $s->annual->id, 'start_date' => '2026-10-19', 'end_date' => '2026-10-19']))
        ->assertOk()
        ->assertJsonPath('balance', null)
        ->assertJsonPath('period.days', 1);

    // The approver (Kepala Divisi) still sees the requester's balance impact.
    $this->actingAs($s->manager)->get("/persetujuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page->where('request.balance.before', 12));
});

it('submits a request through HTTP and redirects to the list', function () {
    $s = $this->s;

    $this->actingAs($s->employee)
        ->post('/pengajuan', [
            'intent' => 'submit',
            'leave_type_id' => $s->annual->id,
            'start_date' => '2026-10-12',
            'end_date' => '2026-10-14',
            'reason' => 'Acara keluarga di luar kota.',
            'substitute_id' => $s->manager->id,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $request = EmployeeRequest::query()->sole();
    expect($request->status)->toBe(RequestStatus::Pending)
        ->and($request->number)->toBe('CUT-2026-10-0001')
        ->and($request->substitute_id)->toBe($s->manager->id);
});

it('returns Indonesian validation errors', function () {
    $s = $this->s;

    $this->actingAs($s->employee)
        ->post('/pengajuan', ['intent' => 'submit', 'leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-30', 'reason' => 'x'])
        ->assertSessionHasErrors(['start_date' => 'Saldo cuti tahunan tidak cukup: sisa 12 hari, diajukan 15 hari.']);

    $this->actingAs($s->employee)
        ->post('/pengajuan', ['intent' => 'submit', 'leave_type_id' => $s->annual->id])
        ->assertSessionHasErrors(['reason' => 'Alasan wajib diisi.']);
});

it('saves a draft, edits it and submits it', function () {
    $s = $this->s;

    $this->actingAs($s->employee)
        ->post('/pengajuan', ['intent' => 'draft', 'leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-12'])
        ->assertRedirect();

    $draft = EmployeeRequest::query()->sole();
    expect($draft->status)->toBe(RequestStatus::Draft)->and($draft->number)->toBeNull();

    $this->actingAs($s->employee)->get("/pengajuan/{$draft->id}/ubah")
        ->assertInertia(fn (Assert $page) => $page->component('requests/form')->where('initial.start_date', '2026-10-12'));

    $this->actingAs($s->employee)
        ->post("/pengajuan/{$draft->id}", ['intent' => 'submit', 'leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-13', 'reason' => 'Liburan.'])
        ->assertRedirect("/pengajuan?pilih={$draft->id}");

    expect($draft->refresh()->status)->toBe(RequestStatus::Pending)->and($draft->days)->toBe(2.0);

    // Others cannot edit it.
    $this->actingAs($s->manager)->get("/pengajuan/{$draft->id}/ubah")->assertForbidden();
});

it('uploads, serves and audits sick-leave attachments privately', function () {
    $s = $this->s;

    $this->actingAs($s->employee)
        ->post('/pengajuan', [
            'intent' => 'submit',
            'leave_type_id' => $s->sick->id,
            'start_date' => '2026-10-06',
            'end_date' => '2026-10-07',
            'reason' => 'Demam.',
            'attachments' => [UploadedFile::fake()->create('surat.pdf', 100, 'application/pdf')],
        ])
        ->assertSessionHasNoErrors();

    $request = EmployeeRequest::query()->sole();
    $attachment = $request->attachments()->sole();

    expect($attachment->source->value)->toBe('storage')
        ->and($attachment->uploaded_by)->toBe($s->employee->id);

    $this->actingAs($s->manager)->get("/pengajuan/{$request->id}/lampiran/{$attachment->id}")
        ->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff');
    expect(AuditLog::query()->where('action', 'request.attachment_viewed')->count())->toBe(1);

    $stranger = User::factory()->create();
    $this->actingAs($stranger)->get("/pengajuan/{$request->id}/lampiran/{$attachment->id}")->assertForbidden();

    // An attachment of another request is not reachable through this one.
    $other = $s->submit($s->manager, $s->annual, ['start_date' => '2026-10-20', 'end_date' => '2026-10-20']);
    $this->actingAs($s->employee)->get("/pengajuan/{$other->id}/lampiran/{$attachment->id}")->assertNotFound();

    $this->actingAs($s->employee)
        ->post('/pengajuan', [
            'intent' => 'submit', 'leave_type_id' => $s->sick->id, 'start_date' => '2026-10-20', 'end_date' => '2026-10-20', 'reason' => 'x',
            'attachments' => [UploadedFile::fake()->create('virus.exe', 10)],
        ])
        ->assertSessionHasErrors('attachments.0');
});

it('cancels a pending request', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    $this->actingAs($s->manager)->post("/pengajuan/{$request->id}/batal")->assertForbidden();
    $this->actingAs($s->employee)->post("/pengajuan/{$request->id}/batal")->assertRedirect();

    expect($request->refresh()->status)->toBe(RequestStatus::Canceled);
});

it('previews days, balance, overlap and the flow without storing anything', function () {
    $s = $this->s;
    notStaff($s->employee);
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    $this->actingAs($s->employee)
        ->getJson('/pengajuan/pratinjau?'.http_build_query(['leave_type_id' => $s->annual->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-14']))
        ->assertOk()
        ->assertJsonPath('period.days', 3)
        ->assertJsonPath('balance.before', 11)
        ->assertJsonPath('balance.after', 8)
        ->assertJsonPath('flow.0.approver.name', 'Dimas Pratama')
        ->assertJsonPath('flow.1.label', 'HR')
        ->assertJsonPath('overlap', 'Tumpang tindih dengan CUT-2026-10-0001 (Cuti tahunan, 12 Okt 2026).');

    $this->actingAs($s->employee)
        ->getJson('/pengajuan/pratinjau?'.http_build_query(['leave_type_id' => $s->annual->id, 'start_date' => '2026-10-10', 'end_date' => '2026-10-11']))
        ->assertOk()
        ->assertJsonPath('period', null)
        ->assertJsonPath('errors.start_date', 'Rentang tanggal tidak berisi hari kerja.');

    expect(EmployeeRequest::query()->count())->toBe(1);
});

it('hides other people\'s requests', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $peer = User::factory()->create();

    $this->actingAs($peer)->get("/pengajuan/{$request->id}")->assertForbidden();
    $this->actingAs($s->manager)->get("/pengajuan/{$request->id}")->assertOk()->assertInertia(fn (Assert $page) => $page->component('requests/show'));
    $this->actingAs($s->hr)->get("/pengajuan/{$request->id}")->assertOk();
});
