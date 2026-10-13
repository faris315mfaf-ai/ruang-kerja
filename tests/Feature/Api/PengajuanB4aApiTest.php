<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\SaveApprovalDelegation;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Notifications\RequestAwaitingApproval;
use App\Models\ApprovalDelegation;
use App\Models\AuditLog;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Support\RequestScenario;
use Tests\TestCase;

/*
| API v1 — B4-A Pengajuan & persetujuan (Bagian 4): jenis with locked types
| and field hints, list filters, drafts, edit, submit/resubmit, cancel,
| attachments, detail, approvals queue + decisions (409 sudah_diputus), HR
| cancellation of approved requests and delegations — all through the web
| actions and policies.
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', 'abababababababababababababababababababababababababababababababab');
} // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));

    $this->s = RequestScenario::make();
    $this->s->employee->update(['email' => 'rizky@kantor.test']);
    $this->s->manager->update(['email' => 'dimas@kantor.test']);
    $this->s->hr->update(['email' => 'hana@kantor.test']);
    $this->s->direksi->update(['email' => 'hendra@kantor.test']);
    $this->tokens = [];
});

/**
 * Calls the API as `email` (one real login per user and test; switching
 * tokens drops the cached sanctum guards, see AuthApiTest).
 */
function sebagaiB4a(string $email): TestCase
{
    $tokens = test()->tokens;

    if (! isset($tokens[$email])) {
        app(Factory::class)->forgetGuards();
        $token = test()->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password',
            'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
        ])->json('token');
        assert(is_string($token) && $token !== '');
        $tokens[$email] = $token;
        test()->tokens = $tokens;
    }

    app(Factory::class)->forgetGuards();

    return test()->withToken($tokens[$email]);
}

/**
 * A request approved by manager and HR.
 */
function disetujuiPenuh(RequestScenario $s, EmployeeRequest $request): EmployeeRequest
{
    return $s->approve($s->hr, $s->approve($s->manager, $request));
}

test('jenis lists locked types with their reason, eligibility, field hints and no balance for staff', function () {
    $s = $this->s;
    $s->annual->update(['locked_reason' => LeaveType::SOP_LOCK_REASON]);
    $s->overtime->update(['locked_reason' => LeaveType::SOP_LOCK_REASON]);
    $s->employee->update(['joined_at' => '2026-09-01']);
    LeaveType::factory()->category($s->sick->category)->withFlow($s->flow)->create(['code' => 'SK2', 'name' => 'Sakit lanjut', 'min_service_months' => 60]);

    $response = sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/pengajuan/jenis')->assertOk();
    $categories = collect($response->json('categories'));
    $types = $categories->flatMap(fn (array $category): array => $category['types'])->keyBy('code');

    expect($categories->pluck('value')->all())->toBe(['leave', 'permit', 'sick', 'overtime', 'correction', 'business_trip', 'procurement'])
        ->and($categories->firstWhere('value', 'leave')['locked'])->toBeTrue()
        ->and($categories->firstWhere('value', 'permit')['locked'])->toBeFalse()
        ->and($types['CUT']['locked'])->toBeTrue()
        ->and($types['CUT']['locked_reason'])->toBe(LeaveType::SOP_LOCK_REASON)
        ->and($types['CUT']['needs_substitute'])->toBeTrue()
        ->and($types['LBR']['locked'])->toBeTrue()
        ->and($types['IZN']['locked'])->toBeFalse()
        ->and($types['IZN']['modes'])->toBe(['days', 'hours'])
        ->and($types['IZN']['fields']['hours'])->toBe(['date', 'start_time', 'end_time', 'reason'])
        ->and($types['SKT']['requires_attachment_after_days'])->toBe(1)
        ->and($types['SK2']['eligible'])->toBeFalse()
        ->and($types['SK2']['ineligible_reason'])->toBe('Anda belum berhak atas Sakit lanjut.')
        ->and($types['KOR']['max_backdate_days'])->toBe(7)
        ->and($types['KOR']['fields'])->toBe(['date', 'check_in', 'check_out', 'reason'])
        ->and($types['BRG']['fields'])->toContain('item_name', 'unit_price', 'urgency')
        ->and($response->json('limits.max_files'))->toBe(5)
        ->and($response->json('limits.mimes'))->toBe(['pdf', 'jpg', 'jpeg', 'png']);

    // Staff (anggota only): no balance key anywhere.
    foreach ($types as $type) {
        expect($type)->not->toHaveKey('balance');
    }

    // Non-staff get the balance of quota types (null for the others).
    $dimas = collect(sebagaiB4a('dimas@kantor.test')->getJson('/api/v1/pengajuan/jenis')->json('categories'))
        ->flatMap(fn (array $category): array => $category['types'])->keyBy('code');

    expect($dimas['CUT'])->toHaveKey('balance')
        ->and($dimas['CUT']['balance'])->toBeArray()
        ->and($dimas['IZN']['balance'])->toBeNull();
});

test('the list filters by status, jenis and tahun with chip counts; balances only for non-staff', function () {
    $s = $this->s;
    $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
    $dinas = $s->submit($s->employee, $s->trip, ['start_date' => '2026-10-19', 'end_date' => '2026-10-20', 'destination' => 'Surabaya']);
    $s->approve($s->hr, $s->approve($s->manager, $dinas));
    sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan/draf', ['type' => $s->permit->id, 'start_date' => '2026-11-02'])->assertCreated();

    $all = sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/pengajuan')->assertOk();

    expect($all->json('meta.total'))->toBe(3)
        ->and($all->json('counts'))->toMatchArray(['semua' => 3, 'menunggu' => 1, 'disetujui' => 1, 'ditolak' => 0, 'draf' => 1])
        ->and($all->json())->not->toHaveKey('balances');

    sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/pengajuan?status=disetujui')
        ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('requests.0.id', $dinas->id)
        ->assertJsonPath('filter.status', 'disetujui');

    sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/pengajuan?jenis=izin')
        ->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('counts.semua', 2);

    sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/pengajuan?jenis='.$s->trip->id)
        ->assertOk()->assertJsonPath('meta.total', 1);

    sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/pengajuan?tahun=2025')
        ->assertOk()->assertJsonPath('meta.total', 0)->assertJsonPath('counts.semua', 0);

    expect(sebagaiB4a('dimas@kantor.test')->getJson('/api/v1/pengajuan')->json())->toHaveKey('balances');
});

test('draft, edit, attachments and submit go through the web actions', function () {
    $s = $this->s;

    // Izin per jam as a draft (reason not yet required).
    $draft = sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan/draf', [
        'type' => $s->permit->id,
        'mode' => 'hours',
        'date' => '2026-10-07',
        'start_time' => '10:00',
        'end_time' => '12:00',
    ])->assertCreated()
        ->assertJsonPath('request.status', 'draft')
        ->assertJsonPath('request.number', null)
        ->assertJsonPath('request.payload.mode', 'hours')
        ->assertJsonPath('request.minutes', 120)
        ->assertJsonPath('request.can.submit', true)
        ->assertJsonPath('request.can.delete', true)
        ->assertJsonPath('request.form.mode', 'hours')
        ->assertJsonPath('request.form.start_time', '10:00');
    $id = $draft->json('request.id');

    // PATCH only what changes; the rest is kept.
    sebagaiB4a('rizky@kantor.test')->patchJson("/api/v1/pengajuan/{$id}", ['end_time' => '13:00', 'reason' => 'Urus SIM.'])
        ->assertOk()
        ->assertJsonPath('request.status', 'draft')
        ->assertJsonPath('request.minutes', 180)
        ->assertJsonPath('request.payload.start_time', '10:00')
        ->assertJsonPath('request.reason', 'Urus SIM.');

    // Attachment upload (single `file`), API stream URL, audited download, removal.
    $uploaded = sebagaiB4a('rizky@kantor.test')->post("/api/v1/pengajuan/{$id}/lampiran", [
        'file' => UploadedFile::fake()->create('surat.pdf', 40, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated();
    $attachment = $uploaded->json('request.attachments.0');

    expect($attachment['filename'])->toBe('surat.pdf')
        ->and($attachment['url'])->toEndWith("/api/v1/pengajuan/{$id}/lampiran/{$attachment['id']}");

    sebagaiB4a('rizky@kantor.test')->get("/api/v1/pengajuan/{$id}/lampiran/{$attachment['id']}")
        ->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    expect(AuditLog::query()->where('action', 'request.attachment_viewed')->count())->toBe(1);

    sebagaiB4a('rizky@kantor.test')->deleteJson("/api/v1/pengajuan/{$id}/lampiran/{$attachment['id']}")
        ->assertOk()->assertJsonCount(0, 'request.attachments');

    // Wrong file type: web message.
    sebagaiB4a('rizky@kantor.test')->post("/api/v1/pengajuan/{$id}/lampiran", [
        'attachments' => [UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream')],
    ], ['Accept' => 'application/json'])->assertUnprocessable()
        ->assertJsonPath('errors', fn (array $errors): bool => in_array('Lampiran harus PDF, JPG, atau PNG.', $errors['attachments.0'] ?? [], true));

    // Kirim: numbered, pending, first approver notified.
    sebagaiB4a('rizky@kantor.test')->postJson("/api/v1/pengajuan/{$id}/kirim")
        ->assertOk()
        ->assertJsonPath('request.status', 'pending')
        ->assertJsonPath('request.number', 'IZN-2026-10-0001')
        ->assertJsonPath('request.can.edit', false)
        ->assertJsonPath('request.can.cancel', true)
        ->assertJsonPath('request.timeline.0.approver.name', 'Dimas Pratama')
        ->assertJsonPath('request.timeline.0.status', 'waiting');

    Notification::assertSentTo($s->manager, RequestAwaitingApproval::class);

    // Pending: no more edits, attachments or delete.
    sebagaiB4a('rizky@kantor.test')->patchJson("/api/v1/pengajuan/{$id}", ['reason' => 'Lain.'])
        ->assertUnprocessable()->assertJsonPath('errors.status.0', 'Pengajuan ini tidak bisa diubah lagi.');
    sebagaiB4a('rizky@kantor.test')->deleteJson("/api/v1/pengajuan/{$id}")
        ->assertUnprocessable()->assertJsonPath('errors.status.0', 'Hanya draf yang bisa dihapus. Batalkan pengajuan ini.');
});

test('locked types are refused for drafts too, exactly like the web', function () {
    $s = $this->s;
    $s->overtime->update(['locked_reason' => LeaveType::SOP_LOCK_REASON]);

    sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan/draf', [
        'type' => $s->overtime->id, 'date' => '2026-10-06', 'start_time' => '17:00', 'end_time' => '20:00',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.leave_type_id.0', 'Lembur belum bisa diajukan. '.LeaveType::SOP_LOCK_REASON);

    expect(EmployeeRequest::query()->count())->toBe(0);
});

test('every category submits with the web rules: sick letter, correction backdate, procurement total', function () {
    $s = $this->s;

    // Sakit 2 hari tanpa surat → wajib lampiran.
    sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan', [
        'type' => $s->sick->id, 'reason' => 'Demam.', 'start_date' => '2026-10-05', 'end_date' => '2026-10-06',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.attachments.0', 'Sakit lebih dari 1 hari wajib melampirkan surat (mis. surat dokter).');

    // ... dengan surat (multipart attachments[]) → terkirim.
    sebagaiB4a('rizky@kantor.test')->post('/api/v1/pengajuan', [
        'type' => $s->sick->id, 'reason' => 'Demam.', 'start_date' => '2026-10-05', 'end_date' => '2026-10-06',
        'attachments' => [UploadedFile::fake()->image('surat.jpg')],
    ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('request.status', 'pending');

    // Koreksi > 7 hari ke belakang ditolak, dalam batas diterima.
    sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan', [
        'type' => $s->correction->id, 'reason' => 'Lupa check-out.', 'date' => '2026-09-25', 'check_out' => '17:05',
    ])->assertUnprocessable()->assertJsonPath('errors.date.0', 'Koreksi maksimal 7 hari ke belakang.');

    sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan', [
        'type' => $s->correction->id, 'reason' => 'Lupa check-out.', 'date' => '2026-10-02', 'check_out' => '17:05',
    ])->assertCreated()->assertJsonPath('request.payload.check_out', '17:05')->assertJsonPath('request.payload.check_in', null);

    // Pengajuan barang: total dihitung server (nilai klien diabaikan).
    $barang = sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan/draf', [
        'type' => $s->procurement->id, 'reason' => 'Kursi rusak.', 'item_name' => 'Kursi kerja',
        'quantity' => 3, 'unit' => 'unit', 'unit_price' => 750000, 'total' => 1, 'urgency' => 'mendesak',
        'reference_url' => 'https://toko.example/kursi',
    ])->assertCreated()
        ->assertJsonPath('request.payload.total', 2250000)
        ->assertJsonPath('request.payload.urgency', 'mendesak');

    sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan/'.$barang->json('request.id').'/kirim')
        ->assertOk()->assertJsonPath('request.status', 'pending')->assertJsonPath('request.number', fn (string $n): bool => str_starts_with($n, 'BRG-'));

    // Dinas luar tanpa tujuan.
    sebagaiB4a('rizky@kantor.test')->postJson('/api/v1/pengajuan', [
        'type' => $s->trip->id, 'reason' => 'Kunjungan.', 'start_date' => '2026-10-26', 'end_date' => '2026-10-27',
    ])->assertUnprocessable()->assertJsonPath('errors.destination.0', 'Tujuan dinas wajib diisi.');
});

test('drafts are deleted, pending requests canceled, and other people never resolve', function () {
    $s = $this->s;
    $draftId = sebagaiB4a('rizky@kantor.test')->post('/api/v1/pengajuan/draf', [
        'type' => $s->permit->id, 'start_date' => '2026-10-12',
        'attachments' => [UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')],
    ], ['Accept' => 'application/json'])->assertCreated()->json('request.id');
    $pending = $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-19', 'end_date' => '2026-10-19']);
    $outsider = User::factory()->withRole(Role::Anggota)->create(['email' => 'luar@kantor.test']);

    // Someone else: 404 everywhere (existence never leaks).
    sebagaiB4a('luar@kantor.test')->getJson("/api/v1/pengajuan/{$pending->id}")->assertNotFound();
    sebagaiB4a('luar@kantor.test')->deleteJson("/api/v1/pengajuan/{$draftId}")->assertNotFound();
    sebagaiB4a('luar@kantor.test')->patchJson("/api/v1/pengajuan/{$draftId}", ['reason' => 'x'])->assertNotFound();
    sebagaiB4a('luar@kantor.test')->postJson("/api/v1/pengajuan/{$pending->id}/batal")->assertNotFound();
    expect($outsider->exists)->toBeTrue();

    sebagaiB4a('rizky@kantor.test')->deleteJson("/api/v1/pengajuan/{$draftId}")->assertNoContent();
    expect(EmployeeRequest::query()->find($draftId))->toBeNull()
        ->and(Storage::disk('local')->allFiles('request-attachments'))->toBe([]);

    sebagaiB4a('rizky@kantor.test')->postJson("/api/v1/pengajuan/{$pending->id}/batal")
        ->assertOk()
        ->assertJsonPath('request.status', 'canceled')
        ->assertJsonPath('request.cancellation.by_requester', true);

    // Approved: the requester can no longer cancel.
    $approved = disetujuiPenuh($s, $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-26', 'end_date' => '2026-10-26']));
    sebagaiB4a('rizky@kantor.test')->postJson("/api/v1/pengajuan/{$approved->id}/batal")
        ->assertUnprocessable()->assertJsonPath('errors.status.0', 'Pengajuan yang sudah diputus tidak bisa dibatalkan.');
});

test('detail shows the timeline and hides the balance from staff only', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
    $s->approve($s->manager, $request, 'Oke, hati-hati.');

    $mine = sebagaiB4a('rizky@kantor.test')->getJson("/api/v1/pengajuan/{$request->id}")->assertOk();

    expect($mine->json('request'))->not->toHaveKey('balance')
        ->and($mine->json('request.timeline.0.status'))->toBe('approved')
        ->and($mine->json('request.timeline.0.note'))->toBe('Oke, hati-hati.')
        ->and($mine->json('request.timeline.1.label'))->toBe('HR')
        ->and($mine->json('request.timeline.1.status'))->toBe('waiting')
        ->and($mine->json('request.step_position'))->toBe(2)
        ->and($mine->json('request.can.approve'))->toBeFalse();

    // Non-staff viewer (HR deciding): balance key present, can decide.
    $hr = sebagaiB4a('hana@kantor.test')->getJson("/api/v1/persetujuan/{$request->id}")->assertOk();

    expect($hr->json('request'))->toHaveKey('balance')
        ->and($hr->json('request.can.approve'))->toBeTrue()
        ->and($hr->json('my_step.label'))->toBe('HR')
        ->and($hr->json('queue.position'))->toBe(1)
        ->and($hr->json('queue.total'))->toBe(1);
});

test('approvals: queue, count, approve, 409 when already decided, reject needs a reason', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    sebagaiB4a('dimas@kantor.test')->getJson('/api/v1/persetujuan/hitung')->assertOk()->assertExactJson(['menunggu' => 1]);
    sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/persetujuan/hitung')->assertOk()->assertExactJson(['menunggu' => 0]);

    sebagaiB4a('dimas@kantor.test')->getJson('/api/v1/persetujuan/daftar')
        ->assertOk()
        ->assertJsonPath('tab', 'menunggu')
        ->assertJsonPath('tabs', ['menunggu', 'diputus'])
        ->assertJsonPath('counts.menunggu', 1)
        ->assertJsonPath('items.0.id', $request->id)
        ->assertJsonPath('items.0.step.label', 'Atasan langsung')
        ->assertJsonPath('items.0.step.on_behalf_of', null)
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('can_cancel_approved', false);

    // The requester cannot decide their own request: 403, not 409.
    sebagaiB4a('rizky@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/setujui")
        ->assertForbidden()->assertJsonPath('message', 'Anda tidak bisa memutus pengajuan ini.');

    sebagaiB4a('dimas@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/setujui", ['note' => 'Silakan.'])
        ->assertOk()
        ->assertJsonPath('request.status', 'pending')
        ->assertJsonPath('request.waiting.label', 'HR')
        ->assertJsonPath('next_id', null)
        ->assertJsonPath('menunggu', 0);

    // Twice: the manager's turn is over.
    sebagaiB4a('dimas@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/setujui")
        ->assertStatus(409)
        ->assertJsonPath('code', 'sudah_diputus')
        ->assertJsonPath('message', 'Langkah ini sudah diputus oleh Anda.')
        ->assertJsonPath('request.status', 'pending');

    sebagaiB4a('dimas@kantor.test')->getJson('/api/v1/persetujuan/daftar?tab=diputus')
        ->assertOk()->assertJsonPath('items.0.my_decision.status', 'approved')->assertJsonPath('items.0.my_decision.note', 'Silakan.');

    // A second HR decides first → the first HR gets 409 with who decided.
    $hr2 = User::factory()->withRole(Role::Hr)->create(['name' => 'Hera Lestari', 'email' => 'hera@kantor.test']);
    sebagaiB4a('hana@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/tolak")
        ->assertUnprocessable()->assertJsonPath('errors.reason.0', 'Alasan wajib diisi saat menolak.');
    sebagaiB4a('hera@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/tolak", ['reason' => 'Bentrok audit.'])
        ->assertOk()->assertJsonPath('request.status', 'rejected');
    sebagaiB4a('hana@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/setujui")
        ->assertStatus(409)->assertJsonPath('code', 'sudah_diputus')
        ->assertJsonPath('message', 'Pengajuan ini sudah ditolak. Tidak ada keputusan yang perlu diambil.');

    sebagaiB4a('rizky@kantor.test')->getJson("/api/v1/pengajuan/{$request->id}")
        ->assertOk()->assertJsonPath('request.decision_note.note', 'Bentrok audit.')->assertJsonPath('request.decision_note.by', 'Hera Lestari');
    expect($hr2->exists)->toBeTrue();
});

test('revision: note required, edit + kirim-ulang opens round 2', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    sebagaiB4a('dimas@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/revisi")
        ->assertUnprocessable()->assertJsonPath('errors.note.0', 'Catatan wajib diisi saat meminta revisi.');
    sebagaiB4a('dimas@kantor.test')->postJson("/api/v1/persetujuan/{$request->id}/revisi", ['note' => 'Cukup satu hari.'])
        ->assertOk()->assertJsonPath('request.status', 'revision_requested');

    sebagaiB4a('rizky@kantor.test')->postJson("/api/v1/pengajuan/{$request->id}/kirim")
        ->assertUnprocessable()->assertJsonPath('errors.status.0', 'Pengajuan ini bukan draf. Gunakan "Revisi & kirim ulang".');

    sebagaiB4a('rizky@kantor.test')->getJson("/api/v1/pengajuan/{$request->id}")
        ->assertOk()->assertJsonPath('request.can.resubmit', true)->assertJsonPath('request.can.submit', false)
        ->assertJsonPath('request.form.end_date', '2026-10-13');

    sebagaiB4a('rizky@kantor.test')->postJson("/api/v1/pengajuan/{$request->id}/kirim-ulang", ['end_date' => '2026-10-12'])
        ->assertOk()
        ->assertJsonPath('request.status', 'pending')
        ->assertJsonPath('request.round', 2)
        ->assertJsonPath('request.days', 1);
});

test('HR cancels an approved request with effects; short reason, non-HR and blockers are refused', function () {
    $s = $this->s;
    $shift = Shift::factory()->create();
    ShiftAssignment::factory()->for($s->employee)->for($shift)->between('2026-01-01')->create();
    $approved = disetujuiPenuh($s, $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']));

    sebagaiB4a('hana@kantor.test')->getJson('/api/v1/persetujuan/daftar?tab=disetujui')
        ->assertOk()->assertJsonPath('tab', 'disetujui')->assertJsonPath('tabs', ['menunggu', 'diputus', 'disetujui'])
        ->assertJsonPath('items.0.id', $approved->id)->assertJsonPath('counts.disetujui', 1);
    sebagaiB4a('dimas@kantor.test')->getJson('/api/v1/persetujuan/daftar?tab=disetujui')
        ->assertOk()->assertJsonPath('tab', 'menunggu');

    sebagaiB4a('hana@kantor.test')->getJson("/api/v1/persetujuan/{$approved->id}")
        ->assertOk()->assertJsonPath('request.can.cancel_approved', true)->assertJsonPath('request.cancel_preview.reason_min', 10);

    sebagaiB4a('dimas@kantor.test')->postJson("/api/v1/pengajuan/{$approved->id}/batal-disetujui", ['reason' => 'Dipanggil kembali untuk audit.'])
        ->assertForbidden()->assertJsonPath('message', 'Hanya HR atau Super Admin yang bisa membatalkan pengajuan yang sudah disetujui.');
    sebagaiB4a('hana@kantor.test')->postJson("/api/v1/pengajuan/{$approved->id}/batal-disetujui", ['reason' => 'Singkat'])
        ->assertUnprocessable()->assertJsonPath('errors.reason.0', 'Tulis alasan pembatalan minimal 10 karakter.');

    $done = sebagaiB4a('hana@kantor.test')->postJson("/api/v1/pengajuan/{$approved->id}/batal-disetujui", ['reason' => 'Dipanggil kembali untuk audit.'])
        ->assertOk()
        ->assertJsonPath('request.status', 'canceled')
        ->assertJsonPath('request.cancellation.after_approval', true)
        ->assertJsonPath('effects.refund_days', null)
        ->assertJsonPath('effects.removed_dates', ['2026-10-12', '2026-10-13'])
        ->assertJsonPath('effects.reclosed_dates', []);

    expect($done->json('effects'))->toHaveKeys(['balance_year', 'unlinked_dates', 'overtime_date', 'correction_date'])
        ->and(AuditLog::query()->where('action', 'request.canceled_approved')->count())->toBe(1);

    // Blocker: the corrected day changed after the correction.
    $correction = disetujuiPenuh($s, $s->submit($s->employee, $s->correction, ['date' => '2026-10-01', 'check_in' => '08:00', 'check_out' => '17:00']));
    AttendanceDay::query()->where('user_id', $s->employee->id)->whereDate('work_date', '2026-10-01')->first()
        ?->update(['check_out_at' => CarbonImmutable::parse('2026-10-01 18:00', 'Asia/Jakarta')->utc()]);

    sebagaiB4a('hana@kantor.test')->postJson("/api/v1/pengajuan/{$correction->id}/batal-disetujui", ['reason' => 'Koreksi salah tanggal.'])
        ->assertUnprocessable()
        ->assertJsonPath('code', 'tidak_bisa_dibatalkan')
        ->assertJsonPath('message', fn (string $message): bool => str_contains($message, 'sudah berubah setelah koreksi'));

    expect($correction->refresh()->status)->toBe(RequestStatus::Approved);
});

test('delegations: create, reroute, Mewakili, edit, overlap, end; HR may only end', function () {
    $s = $this->s;
    $rina = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rina Kusuma', 'email' => 'rina@kantor.test']);
    $request = $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    sebagaiB4a('dimas@kantor.test')->postJson('/api/v1/persetujuan/delegasi', ['delegate_id' => $s->manager->id, 'starts_on' => '2026-10-05', 'ends_on' => '2026-10-09'])
        ->assertUnprocessable()->assertJsonPath('errors.delegate_id.0', 'Pilih rekan aktif lain sebagai delegasi.');
    sebagaiB4a('dimas@kantor.test')->postJson('/api/v1/persetujuan/delegasi', ['delegate_id' => $rina->id, 'starts_on' => '2026-10-09', 'ends_on' => '2026-10-05'])
        ->assertUnprocessable()->assertJsonPath('errors.ends_on.0', 'Tanggal selesai tidak boleh sebelum tanggal mulai.');

    $created = sebagaiB4a('dimas@kantor.test')->postJson('/api/v1/persetujuan/delegasi', [
        'delegate_id' => $rina->id, 'starts_on' => '2026-10-05', 'ends_on' => '2026-10-09', 'reason' => 'Cuti.',
    ])->assertCreated()
        ->assertJsonPath('delegation.delegate.name', 'Rina Kusuma')
        ->assertJsonPath('delegation.active', true);
    $id = $created->json('delegation.id');

    // The waiting step moved to Rina, who represents Dimas.
    expect($request->fresh()?->waitingStep()?->approver_id)->toBe($rina->id);

    sebagaiB4a('rina@kantor.test')->getJson('/api/v1/persetujuan/daftar')
        ->assertOk()
        ->assertJsonPath('items.0.step.on_behalf_of.name', 'Dimas Pratama')
        ->assertJsonPath('delegation.representing.0.delegator.name', 'Dimas Pratama');
    sebagaiB4a('rina@kantor.test')->getJson('/api/v1/persetujuan/delegasi')
        ->assertOk()->assertJsonPath('mine', [])->assertJsonPath('received.0.id', $id);
    sebagaiB4a('dimas@kantor.test')->getJson('/api/v1/persetujuan/daftar')
        ->assertOk()->assertJsonPath('delegation.active.delegate.name', 'Rina Kusuma');

    // Overlapping second delegation.
    sebagaiB4a('dimas@kantor.test')->postJson('/api/v1/persetujuan/delegasi', ['delegate_id' => $s->hr->id, 'starts_on' => '2026-10-08', 'ends_on' => '2026-10-12'])
        ->assertUnprocessable()->assertJsonPath('errors.starts_on.0', 'Sudah ada delegasi pada rentang tanggal ini.');

    // Edit only the end date (reason kept); it does not overlap itself.
    sebagaiB4a('dimas@kantor.test')->patchJson("/api/v1/persetujuan/delegasi/{$id}", ['ends_on' => '2026-10-16'])
        ->assertOk()->assertJsonPath('delegation.ends_on', '2026-10-16')->assertJsonPath('delegation.reason', 'Cuti.');
    expect(AuditLog::query()->where('action', 'approval_delegation.updated')->count())->toBe(1);

    // Others: the employee does not see it (404); HR sees but may not edit (403), may end it.
    sebagaiB4a('rizky@kantor.test')->patchJson("/api/v1/persetujuan/delegasi/{$id}", ['ends_on' => '2026-10-20'])->assertNotFound();
    sebagaiB4a('hana@kantor.test')->patchJson("/api/v1/persetujuan/delegasi/{$id}", ['ends_on' => '2026-10-20'])
        ->assertForbidden()->assertJsonPath('message', 'Hanya pemberi delegasi yang bisa mengubah delegasi ini.');
    sebagaiB4a('hana@kantor.test')->deleteJson("/api/v1/persetujuan/delegasi/{$id}")->assertNoContent();

    expect(ApprovalDelegation::query()->count())->toBe(0)
        ->and($request->fresh()?->waitingStep()?->approver_id)->toBe($s->manager->id);
});

test('a substitute approver of a sick request sees no health details and cannot open attachments', function () {
    $s = $this->s;
    $rina = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rina Kusuma', 'email' => 'rina@kantor.test']);
    app(SaveApprovalDelegation::class)->handle($s->manager, ['delegate_id' => $rina->id, 'starts_on' => '2026-10-05', 'ends_on' => '2026-10-09']);
    $sick = $s->submit($s->employee, $s->sick, [
        'start_date' => '2026-10-05', 'end_date' => '2026-10-06', 'reason' => 'Demam berdarah.',
        'attachments' => [UploadedFile::fake()->create('surat dokter.pdf', 50, 'application/pdf')],
    ]);
    $attachmentId = $sick->attachments()->value('id');

    sebagaiB4a('rina@kantor.test')->getJson("/api/v1/persetujuan/{$sick->id}")
        ->assertOk()
        ->assertJsonPath('request.health_details_hidden', true)
        ->assertJsonPath('request.reason', '')
        ->assertJsonPath('request.attachments', [])
        ->assertJsonPath('request.can.approve', true)
        ->assertJsonPath('my_step.on_behalf_of.name', 'Dimas Pratama');
    sebagaiB4a('rina@kantor.test')->get("/api/v1/pengajuan/{$sick->id}/lampiran/{$attachmentId}", ['Accept' => 'application/json'])
        ->assertForbidden()->assertJsonPath('message', 'Detail kesehatan disembunyikan untuk penyetuju pengganti.');

    // The original approver keeps them.
    sebagaiB4a('dimas@kantor.test')->getJson("/api/v1/persetujuan/{$sick->id}")
        ->assertOk()->assertJsonPath('request.reason', 'Demam berdarah.')->assertJsonCount(1, 'request.attachments');

    expect($sick->fresh()?->waitingStep()?->status)->toBe(ApprovalStatus::Waiting);
});

test('the form preview answers the web summary through the API', function () {
    $s = $this->s;

    sebagaiB4a('rizky@kantor.test')->getJson('/api/v1/pengajuan/pratinjau?'.http_build_query([
        'leave_type_id' => $s->permit->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-13',
    ]))->assertOk()
        ->assertJsonPath('period.days', 2)
        ->assertJsonPath('flow.0.approver.name', 'Dimas Pratama')
        ->assertJsonPath('errors', null);
});

test('B4-A endpoints reject requests without a token', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    test()->getJson("/api/v1/pengajuan/{$request->id}")->assertUnauthorized();
    test()->postJson('/api/v1/pengajuan/draf')->assertUnauthorized();
    test()->getJson('/api/v1/persetujuan/daftar')->assertUnauthorized();
    test()->getJson('/api/v1/persetujuan/hitung')->assertUnauthorized();
    test()->postJson("/api/v1/persetujuan/{$request->id}/setujui")->assertUnauthorized();
    test()->getJson('/api/v1/persetujuan/delegasi')->assertUnauthorized();
});
