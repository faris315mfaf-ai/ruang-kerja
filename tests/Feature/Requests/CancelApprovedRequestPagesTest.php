<?php

use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    $this->approved = fn (User $employee, string $start, string $end): EmployeeRequest => $this->s->approve(
        $this->s->hr,
        $this->s->approve($this->s->manager, $this->s->submit($employee, $this->s->annual, ['start_date' => $start, 'end_date' => $end])),
    );
});

it('offers HR the cancel action with its effects on the approval detail', function () {
    $s = $this->s;
    $request = ($this->approved)($s->employee, '2026-10-12', '2026-10-14');

    $this->actingAs($s->hr)->get("/persetujuan/{$request->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('approvals/show')
            ->where('request.can.cancel_approved', true)
            ->where('request.cancel_preview.refund_days', 3)
            ->where('request.cancel_preview.balance_year', 2026)
            ->where('request.cancel_preview.attendance.removed_dates', ['2026-10-12', '2026-10-13', '2026-10-14'])
            ->where('request.cancel_preview.past_dates', [])
            ->where('request.cancel_preview.blocker', null)
            ->where('request.cancel_preview.reason_min', 10)
            ->where('request.cancellation', null));

    $this->actingAs($s->manager)->get("/persetujuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('request.can.cancel_approved', false)
            ->where('request.cancel_preview', null));

    $this->actingAs($s->employee)->get("/pengajuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page->where('request.can.cancel_approved', false)->where('request.can.cancel', false));
});

it('cancels over HTTP for HR only and shows the requester who canceled and why', function () {
    $s = $this->s;
    $request = ($this->approved)($s->employee, '2026-10-12', '2026-10-12');

    $this->actingAs($s->manager)->post("/persetujuan/{$request->id}/batalkan", ['reason' => 'Dibatalkan atasan tanpa hak.'])->assertForbidden();
    $this->actingAs($s->hr)->post("/persetujuan/{$request->id}/batalkan", ['reason' => 'pendek'])
        ->assertSessionHasErrors(['reason' => 'Tulis alasan pembatalan minimal 10 karakter.']);
    expect($request->refresh()->status)->toBe(RequestStatus::Approved);

    $this->actingAs($s->hr)
        ->from("/persetujuan/{$request->id}")
        ->post("/persetujuan/{$request->id}/batalkan", ['reason' => '  Proyek darurat, cuti dijadwalkan ulang.  '])
        ->assertRedirect("/persetujuan/{$request->id}")
        ->assertInertiaFlash('toast.message', "Pengajuan {$request->number} dibatalkan.");

    expect($request->refresh()->status)->toBe(RequestStatus::Canceled)
        ->and($request->cancel_reason)->toBe('Proyek darurat, cuti dijadwalkan ulang.');

    $this->actingAs($s->employee)->get("/pengajuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('request.status', 'canceled')
            ->where('request.cancellation.by.name', 'Hana Pratiwi')
            ->where('request.cancellation.by_requester', false)
            ->where('request.cancellation.reason', 'Proyek darurat, cuti dijadwalkan ulang.')
            ->where('request.cancellation.after_approval', true)
            ->where('request.cancellation.at', now()->toIso8601String()));

    // A second click (stale page) gets a message, not an error page.
    $this->actingAs($s->hr)->post("/persetujuan/{$request->id}/batalkan", ['reason' => 'Klik kedua dari halaman lama.'])
        ->assertSessionHasErrors(['reason' => 'Pengajuan ini sudah dibatalkan.']);
});

it('lists approved requests in an HR-only tab', function () {
    $s = $this->s;
    $request = ($this->approved)($s->employee, '2026-10-12', '2026-10-12');
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);

    $this->actingAs($s->hr)->get('/persetujuan?tab=disetujui')
        ->assertInertia(fn (Assert $page) => $page
            ->where('tab', 'disetujui')
            ->where('can_cancel_approved', true)
            ->has('items', 1)
            ->where('items.0.id', $request->id)
            ->where('selected.id', $request->id)
            ->where('selected.can.cancel_approved', true));

    $this->actingAs($s->manager)->get('/persetujuan?tab=disetujui')
        ->assertInertia(fn (Assert $page) => $page->where('tab', 'menunggu')->where('can_cancel_approved', false));
});

it('builds the approved tab with a fixed number of queries', function () {
    $s = $this->s;

    $queries = function (int $count) use ($s): int {
        foreach (range(1, $count) as $i) {
            $employee = User::factory()->inDivision($s->division)->managedBy($s->manager)->create();
            ($this->approved)($employee, '2026-10-12', '2026-10-13');
        }

        $this->actingAs($s->hr)->get('/persetujuan?tab=disetujui')->assertOk(); // warms the permission cache
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($s->hr)->get('/persetujuan?tab=disetujui')->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $few = $queries(2);
    $many = $queries(6);

    expect($many)->toBe($few);
});
