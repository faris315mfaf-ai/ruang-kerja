<?php

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Notifications\RequestApproved;
use App\Domain\Requests\Notifications\RequestAwaitingApproval;
use App\Domain\Requests\Services\ColleagueAbsences;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

/*
 * Pengajuan barang (keputusan pemilik 6 Okt 2026): atasan langsung → Direksi,
 * dated on the day it is sent, never touching attendance, balances or overlap.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:15', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

/**
 * @return array<string, mixed>
 */
function itemFields(array $overrides = []): array
{
    return [
        'item_name' => 'Laptop kantor',
        'quantity' => 2,
        'unit' => 'unit',
        'unit_price' => 15000000,
        'reference_url' => 'https://toko.example.com/laptop',
        'urgency' => 'mendesak',
        ...$overrides,
    ];
}

it('goes from the employee to the direct manager to Direksi without touching attendance or balances', function () {
    $s = $this->s;

    $this->actingAs($s->employee)->post('/pengajuan', [
        'intent' => 'submit', 'leave_type_id' => $s->procurement->id, 'reason' => 'Laptop lama rusak.', ...itemFields(),
    ])->assertRedirect()->assertSessionHasNoErrors();

    $request = EmployeeRequest::query()->sole();
    expect($request->number)->toBe('BRG-2026-10-0001')
        ->and($request->status)->toBe(RequestStatus::Pending)
        ->and(OfficeTime::local($request->start_at)->toDateString())->toBe('2026-10-07')
        ->and(OfficeTime::local($request->end_at)->toDateString())->toBe('2026-10-07')
        ->and($request->days)->toBeNull()
        ->and($request->minutes)->toBeNull()
        ->and($request->payload)->toMatchArray([
            'item_name' => 'Laptop kantor', 'quantity' => 2, 'unit' => 'unit', 'unit_price' => 15000000,
            'total' => 30000000, 'reference_url' => 'https://toko.example.com/laptop', 'urgency' => 'mendesak',
        ])
        ->and(RequestFormatter::summary($request))->toBe('Laptop kantor × 2 unit · Rp30.000.000 · mendesak');

    Notification::assertSentTo($s->manager, RequestAwaitingApproval::class, fn (RequestAwaitingApproval $n): bool => $n->title($s->manager) === 'Rizky Aditya mengajukan barang: Laptop kantor · menunggu persetujuan Anda');

    $request = $s->approve($s->manager, $request);
    expect($request->status)->toBe(RequestStatus::Pending)
        ->and($request->waitingStep()?->approver_role)->toBe('direksi');

    // HR is not in the flow.
    expect(fn () => $s->approve($s->hr, $request))->toThrow(Exception::class);

    $request = $s->approve($s->direksi, $request);
    expect($request->status)->toBe(RequestStatus::Approved)
        ->and(AttendanceDay::query()->count())->toBe(0)
        ->and(LeaveBalance::query()->count())->toBe(0);
    Notification::assertSentTo($s->employee, RequestApproved::class);

    // Shown with its item fields to the requester and to Direksi.
    $this->actingAs($s->employee)->get("/pengajuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('request.type.category', 'procurement')
            ->where('request.payload.item_name', 'Laptop kantor')
            ->where('request.payload.total', 30000000)
            ->where('request.colleagues', null)
            ->where('request.balance', null));
});

it('validates the item fields with Indonesian messages', function (array $fields, string $field) {
    $s = $this->s;

    $this->actingAs($s->employee)->post('/pengajuan', [
        'intent' => 'submit', 'leave_type_id' => $s->procurement->id, 'reason' => 'Perlu.', ...itemFields($fields),
    ])->assertSessionHasErrors($field);

    expect(EmployeeRequest::query()->count())->toBe(0);
})->with([
    'no item' => [['item_name' => ''], 'item_name'],
    'zero quantity' => [['quantity' => 0], 'quantity'],
    'no price' => [['unit_price' => ''], 'unit_price'],
    'negative price' => [['unit_price' => -5], 'unit_price'],
    'bad link' => [['reference_url' => 'javascript:alert(1)'], 'reference_url'],
    'bad urgency' => [['urgency' => 'segera'], 'urgency'],
]);

it('requires a reason, defaults the unit and urgency and allows a free price', function () {
    $s = $this->s;

    $this->actingAs($s->employee)->post('/pengajuan', [
        'intent' => 'submit', 'leave_type_id' => $s->procurement->id, 'reason' => '', ...itemFields(),
    ])->assertSessionHasErrors('reason');

    $request = $s->submit($s->employee, $s->procurement, itemFields(['unit' => '', 'urgency' => null, 'unit_price' => 0, 'reference_url' => null]));
    expect($request->payload)->toMatchArray(['unit' => 'unit', 'urgency' => 'biasa', 'total' => 0, 'reference_url' => null]);
});

it('never overlaps with leave, other items or itself and is dated on the day it is sent', function () {
    $s = $this->s;
    $s->submit($s->employee, $s->permit, ['start_date' => '2026-10-07', 'end_date' => '2026-10-07']);

    $first = $s->submit($s->employee, $s->procurement, itemFields());
    $second = $s->submit($s->employee, $s->procurement, itemFields(['item_name' => 'Mouse']));
    expect($first->status)->toBe(RequestStatus::Pending)->and($second->status)->toBe(RequestStatus::Pending);

    // A draft written yesterday takes the date it is finally sent.
    $this->travelTo(CarbonImmutable::parse('2026-10-06 16:00', 'Asia/Jakarta'));
    $this->actingAs($s->employee)->post('/pengajuan', [
        'intent' => 'draft', 'leave_type_id' => $s->procurement->id, 'reason' => 'Kabel.', ...itemFields(['item_name' => 'Kabel HDMI']),
    ])->assertSessionHasNoErrors();
    $draft = EmployeeRequest::query()->where('status', RequestStatus::Draft->value)->sole();
    $this->travelTo(CarbonImmutable::parse('2026-10-08 09:00', 'Asia/Jakarta'));
    $this->actingAs($s->employee)->post("/pengajuan/{$draft->id}", [
        'intent' => 'submit', 'leave_type_id' => $s->procurement->id, 'reason' => 'Kabel.', ...itemFields(['item_name' => 'Kabel HDMI']),
    ])->assertSessionHasNoErrors();

    expect(OfficeTime::local($draft->refresh()->start_at)->toDateString())->toBe('2026-10-08')
        ->and($draft->status)->toBe(RequestStatus::Pending);
});

it('is left out of the colleagues absent list and the attendance effects on cancel', function () {
    $s = $this->s;
    $peer = User::factory()->withRole(Role::Anggota)->inDivision($s->division)->managedBy($s->manager)->create();
    $item = $s->submit($peer, $s->procurement, itemFields());
    $s->approve($s->direksi, $s->approve($s->manager, $item));

    $around = app(ColleagueAbsences::class)->around($s->employee, OfficeTime::startOfDay('2026-10-07'), OfficeTime::endOfDay('2026-10-07'));
    expect($around['people'])->toBe([]);

    $pending = $s->submit($s->employee, $s->procurement, itemFields());
    $this->actingAs($s->employee)->post("/pengajuan/{$pending->id}/batal")->assertRedirect();
    expect($pending->refresh()->status)->toBe(RequestStatus::Canceled)
        ->and(AttendanceDay::query()->count())->toBe(0);
});

it('offers the category in the form and shows it in the approval queue', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->procurement, itemFields());

    $this->actingAs($s->employee)->get('/pengajuan/baru?kategori=barang')
        ->assertInertia(fn (Assert $page) => $page
            ->where('initial.category', 'procurement')
            ->where('categories', fn ($categories) => collect($categories)->contains(fn ($c) => $c['value'] === 'procurement' && $c['label'] === 'Pengajuan barang')));

    $this->actingAs($s->manager)->get('/persetujuan')
        ->assertInertia(fn (Assert $page) => $page->where('items', fn ($items) => collect($items)->contains(fn ($item) => $item['id'] === $request->id && $item['payload']['item_name'] === 'Laptop kantor')));

    $this->actingAs($s->employee)->get("/pengajuan/{$request->id}/ubah")->assertForbidden();
});

it('rejects the procurement fields on a missing scenario type gracefully', function () {
    expect(fn () => $this->s->submit($this->s->employee, $this->s->procurement, ['quantity' => 1, 'unit_price' => 1]))
        ->toThrow(ValidationException::class, 'Nama barang wajib diisi.');
});
