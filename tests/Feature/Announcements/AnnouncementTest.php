<?php

use App\Domain\Announcements\Notifications\AnnouncementPublished;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Models\Announcement;
use App\Models\Company;
use App\Models\Division;
use App\Models\InboxNotification;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

/*
 * Pengumuman (keputusan pemilik 6 Okt 2026). Wednesday 7 Oct 2026 10.00 WIB.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = F::org();
    // Sari leads Tim Gudang (Operasional); a sub-division of Operasional.
    $this->org['gudang']->update(['lead_user_id' => $this->org['sari']->id]);
    $this->sub = Division::factory()->create(['parent_id' => $this->org['ops']->id, 'code' => 'OPSB', 'name' => 'Ops Barat']);
    $this->subMember = User::factory()->withRole(Role::Anggota)->inDivision($this->sub)->create();
});

/**
 * @return list<string>
 */
function bannerIds(User $user): array
{
    return collect(test()->actingAs($user)->getJson('/pengumuman/spanduk')->assertOk()->json('items'))->pluck('id')->all();
}

it('delivers to everyone, a division (with sub-divisions) or a team', function () {
    $all = Announcement::factory()->by($this->org['hr'])->create(['title' => 'Libur bersama']);
    $ops = Announcement::factory()->by($this->org['kadiv'])->forDivisions([$this->org['ops']->id])->create();
    $team = Announcement::factory()->by($this->org['sari'])->forTeams([$this->org['gudang']->id])->create();

    expect(bannerIds($this->org['rizky']))->toEqualCanonicalizing([$all->id, $ops->id])
        ->and(bannerIds($this->org['sari']))->toEqualCanonicalizing([$all->id, $ops->id, $team->id])
        ->and(bannerIds($this->subMember))->toEqualCanonicalizing([$all->id, $ops->id])
        ->and(bannerIds($this->org['budi']))->toBe([$all->id]);

    // Another company never sees it; its own author does on /pengumuman.
    $outsider = User::factory()->forCompany(Company::factory()->create())->create();
    expect(bannerIds($outsider))->toBe([]);
    $this->actingAs($outsider)->post("/pengumuman/{$all->id}/tutup")->assertNotFound();

    $this->actingAs($this->org['kadiv'])->get('/pengumuman')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('announcements/index')
            ->where('mine.0.id', $ops->id)
            ->where('mine.0.audience_label', 'Divisi Operasional')
            ->where('can_create', true));
});

it('shows the latest three on the banner and hides expired, deleted and closed ones', function () {
    $old = Announcement::factory()->by($this->org['hr'])->create(['published_at' => now()->subDays(4)]);
    $items = collect(range(1, 3))->map(fn (int $i) => Announcement::factory()->by($this->org['hr'])->create(['published_at' => now()->subHours($i)]));
    Announcement::factory()->by($this->org['hr'])->expired()->create();
    $deleted = Announcement::factory()->by($this->org['hr'])->create();
    $deleted->delete();

    $this->actingAs($this->org['rizky'])->getJson('/pengumuman/spanduk')
        ->assertOk()
        ->assertJsonPath('total', 4)
        ->assertJsonCount(3, 'items')
        ->assertJsonPath('items.0.id', $items[0]->id);

    $this->actingAs($this->org['rizky'])->post("/pengumuman/{$items[0]->id}/tutup")->assertNoContent();
    $this->actingAs($this->org['rizky'])->post("/pengumuman/{$items[0]->id}/tutup")->assertNoContent();

    expect(bannerIds($this->org['rizky']))->toBe([$items[1]->id, $items[2]->id, $old->id])
        // Closing is personal.
        ->and(bannerIds($this->org['sari']))->toContain($items[0]->id);

    $this->actingAs($this->org['rizky'])->get('/pengumuman')
        ->assertInertia(fn (Assert $page) => $page
            ->has('received', 4)
            ->where('received.0.dismissed', true)
            ->where('can_create', false)
            ->where('options', null));
});

it('notifies the recipients except the author and keeps the Inbox after closing or deleting', function () {
    $this->actingAs($this->org['kadiv'])->post('/pengumuman', [
        'title' => 'Stok opname Jumat',
        'body' => "Semua anggota Operasional ikut stok opname.\nMulai 08.00.",
        'audience' => 'division',
        'target_ids' => [$this->org['ops']->id],
        'expires_on' => '2026-10-10',
    ])->assertRedirect('/pengumuman')->assertSessionHasNoErrors();

    $announcement = Announcement::query()->sole();
    expect($announcement->expires_at?->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'))->toBe('2026-10-10 23:59');

    $inbox = fn (User $user) => InboxNotification::query()->where('notifiable_id', $user->id)->where('type', NotificationType::SystemAnnouncement->value);

    expect($inbox($this->org['rizky'])->count())->toBe(1)
        ->and($inbox($this->org['sari'])->count())->toBe(1)
        ->and($inbox($this->subMember)->count())->toBe(1)
        ->and($inbox($this->org['kadiv'])->count())->toBe(0)
        ->and($inbox($this->org['budi'])->count())->toBe(0)
        ->and($inbox($this->org['rizky'])->first()?->data['title'])->toBe('Pengumuman: Stok opname Jumat');

    $this->actingAs($this->org['rizky'])->post("/pengumuman/{$announcement->id}/tutup")->assertNoContent();
    expect($inbox($this->org['rizky'])->count())->toBe(1);

    // Only the author deletes; it disappears everywhere, the Inbox stays.
    $this->actingAs($this->org['rizky'])->delete("/pengumuman/{$announcement->id}")->assertForbidden();
    $this->actingAs($this->org['budi'])->delete("/pengumuman/{$announcement->id}")->assertNotFound();
    $this->actingAs($this->org['kadiv'])->delete("/pengumuman/{$announcement->id}")->assertRedirect('/pengumuman');

    expect(Announcement::query()->find($announcement->id))->toBeNull()
        ->and(Announcement::withTrashed()->find($announcement->id)?->trashed())->toBeTrue()
        ->and(bannerIds($this->org['sari']))->toBe([])
        ->and($inbox($this->org['sari'])->count())->toBe(1);
});

it('drops a queued notification of a deleted announcement', function () {
    $announcement = Announcement::factory()->by($this->org['hr'])->create();
    $notification = new AnnouncementPublished($announcement);
    $announcement->delete();

    expect($notification->shouldSend($this->org['rizky'], 'database'))->toBeFalse();
});

it('lets each role announce only to whom it may', function (string $who, array $allowed) {
    $user = $this->org[$who];
    $targets = [
        'all' => ['audience' => 'all', 'target_ids' => []],
        'ops' => ['audience' => 'division', 'target_ids' => [$this->org['ops']->id]],
        'keu' => ['audience' => 'division', 'target_ids' => [$this->org['keu']->id]],
        'gudang' => ['audience' => 'team', 'target_ids' => [$this->org['gudang']->id]],
    ];

    foreach ($targets as $key => $target) {
        $response = $this->actingAs($user)->post('/pengumuman', ['title' => "Uji {$key}", 'body' => 'Isi', ...$target]);

        if (in_array($key, $allowed, true)) {
            $response->assertSessionHasNoErrors();
        } elseif ($allowed === []) {
            $response->assertForbidden();
        } else {
            $response->assertSessionHasErrors('target_ids');
        }
    }

    expect(Announcement::query()->where('author_id', $user->id)->count())->toBe(count($allowed));
})->with([
    'super_admin' => ['admin', ['all', 'ops', 'keu', 'gudang']],
    'direksi' => ['direksi', ['all', 'ops', 'keu', 'gudang']],
    'hr' => ['hr', ['all', 'ops', 'keu', 'gudang']],
    'kepala divisi' => ['kadiv', ['ops']],
    'ketua tim (staf)' => ['sari', ['gudang']],
    'anggota' => ['rizky', []],
]);

it('validates the form', function () {
    $this->actingAs($this->org['hr'])->post('/pengumuman', ['title' => '', 'body' => '', 'audience' => 'semua'])
        ->assertSessionHasErrors(['title', 'body', 'audience']);
    $this->actingAs($this->org['hr'])->post('/pengumuman', ['title' => 'A', 'body' => 'B', 'audience' => 'division', 'target_ids' => []])
        ->assertSessionHasErrors('target_ids');
    $this->actingAs($this->org['hr'])->post('/pengumuman', ['title' => 'A', 'body' => 'B', 'audience' => 'all', 'expires_on' => '2026-10-06'])
        ->assertSessionHasErrors('expires_on');

    expect(Announcement::query()->count())->toBe(0);
});

it('matches the policy matrix', function () {
    $own = Announcement::factory()->by($this->org['kadiv'])->forDivisions([$this->org['ops']->id])->create();
    $gate = fn (User $user) => Gate::forUser($user);

    expect($gate($this->org['rizky'])->allows('view', $own))->toBeTrue()
        ->and($gate($this->org['budi'])->allows('view', $own))->toBeFalse()
        ->and($gate($this->org['kadiv'])->allows('delete', $own))->toBeTrue()
        ->and($gate($this->org['hr'])->allows('delete', $own))->toBeFalse()
        ->and($gate($this->org['rizky'])->allows('update', $own))->toBeFalse()
        ->and($gate(User::factory()->withRole(Role::Hr)->inactive()->create())->allows('create', Announcement::class))->toBeFalse()
        ->and($gate($this->org['admin'])->allows('create', Announcement::class))->toBeTrue()
        ->and($gate($this->org['rizky'])->allows('create', Announcement::class))->toBeFalse();
});

it('loads the banner apart from the dashboards and links it everywhere', function () {
    Notification::fake();
    Announcement::factory()->by($this->org['hr'])->create();

    foreach (['/dashboard/saya' => 'rizky', '/dashboard/divisi' => 'kadiv', '/dashboard/hr' => 'hr', '/manajemen' => 'direksi', '/portofolio' => 'direksi'] as $url => $who) {
        $this->actingAs($this->org[$who])->get($url)->assertOk();
    }

    expect(bannerIds($this->org['direksi']))->toHaveCount(1);
});

it('ignores teams of another company as targets', function () {
    $foreign = Team::factory()->create(['division_id' => Division::factory()->create(['company_id' => Company::factory()->create()->id])->id]);

    $this->actingAs($this->org['hr'])->post('/pengumuman', ['title' => 'A', 'body' => 'B', 'audience' => 'team', 'target_ids' => [$foreign->id]])
        ->assertSessionHasErrors('target_ids');
});
