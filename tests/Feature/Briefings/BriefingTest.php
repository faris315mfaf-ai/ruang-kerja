<?php

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Briefings\Queries\BriefingWindow;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Models\Briefing;
use App\Models\BriefingDelegation;
use App\Models\Company;
use App\Models\InboxNotification;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

/*
 * Briefing pagi & sore (keputusan pemilik 9 Okt 2026). Friday 9 Oct 2026;
 * jendela catat: pagi 08.00–11.00, sore 16.00–18.00 waktu kantor
 * (Asia/Jakarta). Pencatat: HR & Super Admin, atau yang mereka tunjuk
 * (delegasi per tanggal + periode).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->org = F::org();
    $this->outsider = User::factory()->forCompany(Company::factory()->create())->create(['name' => 'Eksternal']);
});

/**
 * Inbox rows of one user for one notification type.
 */
function inboxFor(User $user, NotificationType $type = NotificationType::BriefingPosted)
{
    return InboxNotification::query()
        ->where('notifiable_id', $user->id)
        ->where('type', $type->value);
}

it('opens the pagi window in the morning and the sore window in the afternoon only', function (string $time, ?string $open) {
    expect(BriefingPeriod::open(F::at("2026-10-09 {$time}"))?->value)->toBe($open);
})->with([
    'sebelum pagi' => ['07:59', null],
    'awal pagi' => ['08:00', 'pagi'],
    'tengah pagi' => ['09:00', 'pagi'],
    'akhir jendela pagi' => ['11:00', 'pagi'],
    'siang' => ['12:00', null],
    'awal sore' => ['16:00', 'sore'],
    'sore' => ['16:30', 'sore'],
    'setelah sore' => ['18:01', null],
]);

it('shows the recorder card only to HR, Super Admin and the appointed delegate', function () {
    // Plain employee: no card at all.
    $this->actingAs($this->org['rizky'])->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard/personal')
            ->where('briefing', null));

    // HR sees the open window and may record it.
    $this->travelTo(F::at('2026-10-09 09:00'));
    $this->actingAs($this->org['hr'])->get('/dashboard/hr')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('briefing.date', '2026-10-09')
            ->where('briefing.current', 'pagi')
            ->where('briefing.can_record', true)
            ->where('briefing.is_recorder', true)
            ->where('briefing.periods.0.status', 'open')
            ->where('briefing.periods.1.status', 'before')
            ->where('briefing.saved.pagi', null)
            ->where('briefing.urls.store', '/briefing'));

    // The appointed delegate of today's sore briefing also gets the card.
    BriefingDelegation::query()->create([
        'company_id' => $this->org['hr']->company_id,
        'briefing_date' => '2026-10-09',
        'period' => BriefingPeriod::Sore,
        'delegated_to' => $this->org['rizky']->id,
        'delegated_by' => $this->org['hr']->id,
    ]);

    $this->actingAs($this->org['rizky'])->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('briefing.is_recorder', false)
            ->where('briefing.delegations.sore.to.name', 'Rizky Aditya')
            ->where('briefing.delegations.sore.by.name', 'Hana HR')
            ->where('briefing.can_record', false)); // pagi is open, rizky is delegate of sore only
});

it('saves the morning briefing and notifies the whole company with the full content', function () {
    $this->travelTo(F::at('2026-10-09 09:00'));
    $content = "1. Target hari ini 40 pesanan\r\n2. Cek stok tinta\n3. Brief kirim Jumat";

    $this->actingAs($this->org['hr'])
        ->post('/briefing', ['period' => 'pagi', 'content' => $content])
        ->assertRedirect()
        // Inertia::flash() lands in the flash-data session key the shell's
        // use-flash-toast hook reads (same mechanism as the other modules).
        ->assertSessionHas('inertia.flash_data.toast.type', 'success')
        ->assertSessionHasNoErrors();

    $briefing = Briefing::query()->sole();
    expect($briefing->briefing_date->toDateString())->toBe('2026-10-09')
        ->and($briefing->period)->toBe(BriefingPeriod::Pagi)
        // CRLF normalized, surrounding whitespace trimmed, inner newlines kept.
        ->and($briefing->content)->toBe("1. Target hari ini 40 pesanan\n2. Cek stok tinta\n3. Brief kirim Jumat")
        ->and($briefing->created_by)->toBe($this->org['hr']->id)
        ->and($briefing->delegated_from)->toBeNull();

    $this->assertDatabaseHas('audit_logs', ['action' => 'briefing.saved', 'auditable_id' => $briefing->id]);

    // Everyone of the company — including the recorder — gets the full note.
    foreach (['rizky', 'sari', 'budi', 'kadiv', 'kadivKeu', 'hr', 'direksi', 'admin'] as $who) {
        expect(inboxFor($this->org[$who])->count())->toBe(1);
    }

    $row = inboxFor($this->org['rizky'])->sole();
    expect($row->data['title'])->toBe('Briefing pagi 9 Oktober 2026')
        ->and($row->data['body'])->toBe($briefing->content)
        ->and($row->data['actor']['name'])->toBe('Hana HR')
        ->and($row->action_required)->toBeFalse();

    expect(inboxFor($this->outsider)->count())->toBe(0);
});

it('rejects saving outside the recording window', function () {
    $this->travelTo(F::at('2026-10-09 12:00'));

    $this->actingAs($this->org['hr'])
        ->post('/briefing', ['period' => 'pagi', 'content' => 'Terlambat'])
        ->assertRedirect()
        ->assertSessionHasErrors('period');

    $this->travelTo(F::at('2026-10-09 18:30'));

    $this->actingAs($this->org['admin'])
        ->post('/briefing', ['period' => 'sore', 'content' => 'Sudah tutup'])
        ->assertSessionHasErrors('period');

    expect(Briefing::query()->count())->toBe(0);
});

it('matches the recorder policy matrix', function () {
    $gate = fn (User $user) => Gate::forUser($user);

    expect($gate($this->org['hr'])->allows('create', Briefing::class))->toBeTrue()
        ->and($gate($this->org['admin'])->allows('create', Briefing::class))->toBeTrue()
        ->and($gate($this->org['direksi'])->allows('create', Briefing::class))->toBeFalse()
        ->and($gate($this->org['kadiv'])->allows('create', Briefing::class))->toBeFalse()
        ->and($gate($this->org['rizky'])->allows('create', Briefing::class))->toBeFalse()
        ->and($gate($this->outsider)->allows('create', Briefing::class))->toBeFalse()
        ->and($gate($this->org['hr'])->allows('delegate', Briefing::class))->toBeTrue()
        ->and($gate($this->org['admin'])->allows('delegate', Briefing::class))->toBeTrue()
        ->and($gate($this->org['direksi'])->allows('delegate', Briefing::class))->toBeFalse()
        ->and($gate($this->org['rizky'])->allows('delegate', Briefing::class))->toBeFalse()
        ->and($gate(User::factory()->withRole(Role::Hr)->inactive()->create())->allows('create', Briefing::class))->toBeFalse();

    $briefing = Briefing::query()->create([
        'company_id' => $this->org['hr']->company_id,
        'period' => BriefingPeriod::Pagi,
        'briefing_date' => '2026-10-09',
        'content' => 'Isi',
        'created_by' => $this->org['hr']->id,
    ]);

    // Saved notes are readable by every employee of the company, no one else.
    expect($gate($this->org['rizky'])->allows('view', $briefing))->toBeTrue()
        ->and($gate($this->outsider)->allows('view', $briefing))->toBeFalse()
        ->and($gate(User::factory()->withRole(Role::Hr)->inactive()->create())->allows('view', $briefing))->toBeFalse()
        ->and($gate($this->org['rizky'])->allows('delete', $briefing))->toBeFalse();

    // Once appointed, today's delegate passes the create gate too.
    BriefingDelegation::query()->create([
        'company_id' => $this->org['hr']->company_id,
        'briefing_date' => '2026-10-09',
        'period' => BriefingPeriod::Sore,
        'delegated_to' => $this->org['rizky']->id,
        'delegated_by' => $this->org['hr']->id,
    ]);

    $this->travelTo(F::at('2026-10-09 09:00'));
    expect($gate($this->org['rizky'])->allows('create', Briefing::class))->toBeTrue()
        ->and($gate($this->org['sari'])->allows('create', Briefing::class))->toBeFalse();
});

it('delegates the note-taking: the delegate records as if they were the recorder', function () {
    $this->travelTo(F::at('2026-10-09 09:30'));

    $this->actingAs($this->org['hr'])
        ->post('/briefing/delegasi', ['user_id' => $this->org['rizky']->id, 'period' => 'sore'])
        ->assertRedirect()
        ->assertSessionHas('inertia.flash_data.toast.type', 'success');

    $delegation = BriefingDelegation::query()->sole();
    expect($delegation->delegated_to)->toBe($this->org['rizky']->id)
        ->and($delegation->delegated_by)->toBe($this->org['hr']->id)
        ->and($delegation->period)->toBe(BriefingPeriod::Sore)
        ->and($delegation->briefing_date->toDateString())->toBe('2026-10-09');

    // The delegate is told in-app (system notice, locked in the Inbox).
    $notice = inboxFor($this->org['rizky'], NotificationType::SystemAnnouncement)->sole();
    expect($notice->data['title'])->toBe('Anda ditunjuk mencatat briefing sore')
        ->and($notice->data['body'])->toContain('Hana HR menunjuk Anda mencatat notulensi briefing sore');

    // Inside the sore window the delegate records; delegated_from remembers HR.
    $this->travelTo(F::at('2026-10-09 16:30'));

    $this->actingAs($this->org['rizky'])
        ->post('/briefing', ['period' => 'sore', 'content' => "Serah terima shift\nStock opname gudang"])
        ->assertSessionHasNoErrors();

    $briefing = Briefing::query()->sole();
    expect($briefing->created_by)->toBe($this->org['rizky']->id)
        ->and($briefing->delegated_from)->toBe($this->org['hr']->id)
        ->and($briefing->title())->toBe('Briefing sore 9 Oktober 2026');

    expect(inboxFor($this->org['budi'])->sole()->data['body'])->toBe("Serah terima shift\nStock opname gudang");

    // Another employee without an appointment may not record.
    $this->actingAs($this->org['sari'])
        ->post('/briefing', ['period' => 'sore', 'content' => 'Bukan pencatat'])
        ->assertForbidden();

    // The delegate may not record the period they were not appointed for
    // (pagi's window is closed by then → validation error, not a 403).
    $this->actingAs($this->org['rizky'])
        ->post('/briefing', ['period' => 'pagi', 'content' => 'Salah periode'])
        ->assertSessionHasErrors('period');
});

it('re-delegating the same period replaces the target and notifies only the new one', function () {
    $this->travelTo(F::at('2026-10-09 09:00'));

    $this->actingAs($this->org['hr'])->post('/briefing/delegasi', ['user_id' => $this->org['rizky']->id, 'period' => 'pagi']);
    $this->actingAs($this->org['hr'])->post('/briefing/delegasi', ['user_id' => $this->org['sari']->id, 'period' => 'pagi']);

    expect(BriefingDelegation::query()->count())->toBe(1)
        ->and(BriefingDelegation::query()->sole()->delegated_to)->toBe($this->org['sari']->id)
        ->and(inboxFor($this->org['rizky'], NotificationType::SystemAnnouncement)->count())->toBe(1)
        ->and(inboxFor($this->org['sari'], NotificationType::SystemAnnouncement)->count())->toBe(1);

    // Self-delegation and foreign companies are refused with a friendly error.
    $this->actingAs($this->org['hr'])
        ->post('/briefing/delegasi', ['user_id' => $this->org['hr']->id, 'period' => 'pagi'])
        ->assertSessionHasErrors('user_id');
    $this->actingAs($this->org['admin'])
        ->post('/briefing/delegasi', ['user_id' => $this->outsider->id, 'period' => 'pagi'])
        ->assertSessionHasErrors('user_id');
});

it('is idempotent: saving again updates the note without a second notification', function () {
    $this->travelTo(F::at('2026-10-09 08:30'));

    $this->actingAs($this->org['hr'])->post('/briefing', ['period' => 'pagi', 'content' => 'Versi satu']);
    $this->travelTo(F::at('2026-10-09 10:00'));
    $this->actingAs($this->org['admin'])->post('/briefing', ['period' => 'pagi', 'content' => 'Versi dua, direvisi']);

    expect(Briefing::query()->count())->toBe(1)
        ->and(Briefing::query()->sole()->content)->toBe('Versi dua, direvisi')
        ->and(Briefing::query()->sole()->created_by)->toBe($this->org['admin']->id);

    // Only the first save notified the company.
    expect(inboxFor($this->org['rizky'])->count())->toBe(1)
        ->and(inboxFor($this->org['budi'])->count())->toBe(1)
        ->and(inboxFor($this->org['rizky'])->sole()->data['body'])->toBe('Versi satu');
});

it('keeps one note per period and offers the latest of each period', function () {
    Briefing::query()->create([
        'company_id' => $this->org['hr']->company_id,
        'period' => BriefingPeriod::Sore,
        'briefing_date' => '2026-10-08',
        'content' => 'Sore kemarin',
        'created_by' => $this->org['hr']->id,
    ]);

    $this->travelTo(F::at('2026-10-09 09:00'));
    $this->actingAs($this->org['hr'])->post('/briefing', ['period' => 'pagi', 'content' => 'Rencana pagi']);

    // Today's pagi is saved; today's sore is not → the latest sore note is offered.
    $card = app(BriefingWindow::class)->card($this->org['hr'], F::at('2026-10-09 09:00'));
    expect($card['saved']['pagi']['content'])->toBe('Rencana pagi')
        ->and($card['saved']['sore'])->toBeNull()
        ->and($card['latest']['pagi'])->toBeNull()
        ->and($card['latest']['sore']['content'])->toBe('Sore kemarin')
        ->and($card['latest']['sore']['date'])->toBe('2026-10-08');

    $this->travelTo(F::at('2026-10-09 16:10'));
    $this->actingAs($this->org['hr'])->post('/briefing', ['period' => 'sore', 'content' => 'Hasil sore']);

    expect(Briefing::query()->count())->toBe(3)
        ->and(Briefing::query()->whereDate('briefing_date', '2026-10-09')->count())->toBe(2)
        ->and(inboxFor($this->org['rizky'])->count())->toBe(2); // pagi + sore of today, each notified once
});

it('validates the form', function () {
    $this->travelTo(F::at('2026-10-09 09:00'));

    $this->actingAs($this->org['hr'])
        ->post('/briefing', ['period' => 'sore', 'content' => ''])
        ->assertSessionHasErrors(['content']);
    $this->actingAs($this->org['hr'])
        ->post('/briefing', ['period' => 'magrib', 'content' => 'Isi'])
        ->assertSessionHasErrors(['period']);
    $this->actingAs($this->org['hr'])
        ->post('/briefing', ['period' => 'pagi', 'content' => '   '])
        ->assertSessionHasErrors(['content']);

    expect(Briefing::query()->count())->toBe(0)
        ->and(inboxFor($this->org['rizky'])->count())->toBe(0);
});
