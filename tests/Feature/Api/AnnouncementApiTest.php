<?php

use App\Domain\Announcements\Jobs\SendAnnouncementNotifications;
use App\Models\Announcement;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

/*
| API v1 — pengumuman untuk ponsel (Bagian 2 / B2-B): AnnouncementFeed,
| Action Publish/Delete/Dismiss dan AnnouncementPolicy web (bukan alamatnya
| → 404, hanya pembuat menghapus, hak umum per peran lewat AnnouncementTargets).
| Rabu 7 Okt 2026 10.00 WIB.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = F::org();
    $this->org['gudang']->update(['lead_user_id' => $this->org['sari']->id]);
});

test('"untuk-saya" lists what is addressed to me, newest first, with closed ones marked', function () {
    $semua = Announcement::factory()->by($this->org['hr'])->create(['title' => 'Libur bersama', 'published_at' => now()->subHours(2)]);
    $ops = Announcement::factory()->by($this->org['kadiv'])->forDivisions([$this->org['ops']->id])->create(['title' => 'Stok opname', 'published_at' => now()->subHour()]);
    Announcement::factory()->by($this->org['kadivKeu'])->forDivisions([$this->org['keu']->id])->create(['title' => 'Khusus Keuangan']);
    Announcement::factory()->by($this->org['hr'])->expired()->create(['title' => 'Sudah lewat']);

    Sanctum::actingAs($this->org['rizky']);
    $this->postJson("/api/v1/pengumuman/{$semua->id}/tutup")->assertNoContent();

    $this->getJson('/api/v1/pengumuman')
        ->assertOk()
        ->assertJsonPath('tab', 'untuk-saya')
        ->assertJsonPath('can_create', false)
        ->assertJsonCount(2, 'items')
        ->assertJsonPath('items.0.id', $ops->id)
        ->assertJsonPath('items.0.audience_label', 'Divisi Operasional')
        ->assertJsonPath('items.0.dismissed', false)
        ->assertJsonPath('items.0.can_delete', false)
        ->assertJsonPath('items.1.id', $semua->id)
        ->assertJsonPath('items.1.dismissed', true)
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.per_page', 20);
});

test('"saya-buat" lists what I wrote, expired ones included, and marks them deletable', function () {
    $mine = Announcement::factory()->by($this->org['kadiv'])->forDivisions([$this->org['ops']->id])->create(['title' => 'Milik Dimas']);
    $old = Announcement::factory()->by($this->org['kadiv'])->forDivisions([$this->org['ops']->id])->expired()->create(['title' => 'Lama', 'published_at' => now()->subWeek()]);
    Announcement::factory()->by($this->org['hr'])->create();

    Sanctum::actingAs($this->org['kadiv']);

    $this->getJson('/api/v1/pengumuman?tab=saya-buat')
        ->assertOk()
        ->assertJsonPath('tab', 'saya-buat')
        ->assertJsonPath('can_create', true)
        ->assertJsonCount(2, 'items')
        ->assertJsonPath('items.0.id', $mine->id)
        ->assertJsonPath('items.0.can_delete', true)
        ->assertJsonPath('items.1.id', $old->id)
        ->assertJsonPath('items.1.active', false);
});

test('lists are paginated, 20 per page', function () {
    Announcement::factory()->by($this->org['hr'])->count(23)->create();
    Sanctum::actingAs($this->org['rizky']);

    $this->getJson('/api/v1/pengumuman')->assertJsonCount(20, 'items')->assertJsonPath('meta.last_page', 2)->assertJsonPath('meta.total', 23);
    $this->getJson('/api/v1/pengumuman?page=2')->assertJsonCount(3, 'items');
});

test('the banner is the latest three open ones and "spanduk" hides what I closed', function () {
    $items = Announcement::factory()->by($this->org['hr'])->count(4)->sequence(
        ['published_at' => now()->subHours(4)],
        ['published_at' => now()->subHours(3)],
        ['published_at' => now()->subHours(2)],
        ['published_at' => now()->subHour()],
    )->create();

    Sanctum::actingAs($this->org['rizky']);

    $this->getJson('/api/v1/pengumuman/spanduk')->assertOk()
        ->assertJsonPath('total', 4)
        ->assertJsonCount(3, 'items')
        ->assertJsonPath('items.0.id', $items[3]->id);

    $this->postJson("/api/v1/pengumuman/{$items[3]->id}/tutup")->assertNoContent();
    $this->postJson("/api/v1/pengumuman/{$items[3]->id}/tutup")->assertNoContent(); // idempotent

    $this->getJson('/api/v1/pengumuman/spanduk')->assertJsonPath('total', 3)->assertJsonPath('items.0.id', $items[2]->id);
});

test('a detail is readable only by its recipients and its author', function () {
    $ops = Announcement::factory()->by($this->org['kadiv'])->forDivisions([$this->org['ops']->id])->create(['title' => 'Khusus Ops']);

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson("/api/v1/pengumuman/{$ops->id}")->assertOk()
        ->assertJsonPath('pengumuman.title', 'Khusus Ops')
        ->assertJsonPath('pengumuman.author.name', 'Dimas Pratama')
        ->assertJsonPath('pengumuman.dismissed', false);

    Sanctum::actingAs($this->org['budi']);
    $this->getJson("/api/v1/pengumuman/{$ops->id}")->assertNotFound();
    $this->postJson("/api/v1/pengumuman/{$ops->id}/tutup")->assertNotFound();

    Sanctum::actingAs(User::factory()->forCompany(Company::factory()->create())->create());
    $this->getJson("/api/v1/pengumuman/{$ops->id}")->assertNotFound();

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/pengumuman/01ARZ3NDEKTSV4RRFFQ69G5FAV')->assertNotFound();
});

test('HR announces to everyone and the recipients are notified in the background', function () {
    Sanctum::actingAs($this->org['hr']);

    $response = $this->postJson('/api/v1/pengumuman', [
        'title' => 'Libur Maulid',
        'body' => 'Kantor libur Kamis.',
        'audience' => 'all',
        'expires_on' => '2026-10-09',
    ])->assertCreated()
        ->assertJsonPath('message', 'Pengumuman diterbitkan.')
        ->assertJsonPath('pengumuman.title', 'Libur Maulid')
        ->assertJsonPath('pengumuman.audience_label', 'Semua karyawan')
        ->assertJsonPath('pengumuman.can_delete', true)
        ->assertJsonPath('pengumuman.author.name', 'Hana HR');

    expect(Announcement::query()->count())->toBe(1);
    Queue::assertPushed(SendAnnouncementNotifications::class, fn ($job): bool => $job->announcementId === $response->json('pengumuman.id'));
});

test('a division head announces to the own division only, a team lead to the own team only', function () {
    Sanctum::actingAs($this->org['kadiv']);
    $this->postJson('/api/v1/pengumuman', ['title' => 'Ops', 'body' => 'Isi', 'audience' => 'division', 'target_ids' => [$this->org['ops']->id]])->assertCreated();
    $this->postJson('/api/v1/pengumuman', ['title' => 'Semua', 'body' => 'Isi', 'audience' => 'all'])
        ->assertUnprocessable()->assertJsonValidationErrors('target_ids');
    $this->postJson('/api/v1/pengumuman', ['title' => 'Keu', 'body' => 'Isi', 'audience' => 'division', 'target_ids' => [$this->org['keu']->id]])
        ->assertUnprocessable()->assertJsonValidationErrors('target_ids');

    Sanctum::actingAs($this->org['sari']);
    $this->postJson('/api/v1/pengumuman', ['title' => 'Gudang', 'body' => 'Isi', 'audience' => 'team', 'target_ids' => [$this->org['gudang']->id]])->assertCreated();
    $this->postJson('/api/v1/pengumuman', ['title' => 'Ops', 'body' => 'Isi', 'audience' => 'division', 'target_ids' => [$this->org['ops']->id]])
        ->assertUnprocessable();

    expect(Announcement::query()->count())->toBe(2);
});

test('creating is refused to plain staff and validated for everyone else', function () {
    Sanctum::actingAs($this->org['rizky']);
    $this->postJson('/api/v1/pengumuman', ['title' => 'Coba', 'body' => 'Isi', 'audience' => 'all'])->assertForbidden();

    Sanctum::actingAs($this->org['hr']);
    $this->postJson('/api/v1/pengumuman', ['body' => 'Tanpa judul', 'audience' => 'all'])
        ->assertUnprocessable()->assertJsonValidationErrors('title');
    $this->postJson('/api/v1/pengumuman', ['title' => 'Salah', 'body' => 'Isi', 'audience' => 'semua'])
        ->assertUnprocessable()->assertJsonValidationErrors('audience');
    $this->postJson('/api/v1/pengumuman', ['title' => 'Kemarin', 'body' => 'Isi', 'audience' => 'all', 'expires_on' => '2026-10-06'])
        ->assertUnprocessable()->assertJsonValidationErrors('expires_on');

    expect(Announcement::query()->count())->toBe(0);
});

test('only the author deletes, and it disappears from every list', function () {
    $mine = Announcement::factory()->by($this->org['hr'])->create();

    Sanctum::actingAs($this->org['rizky']);
    $this->deleteJson("/api/v1/pengumuman/{$mine->id}")->assertForbidden();
    $this->getJson('/api/v1/pengumuman/spanduk')->assertJsonPath('total', 1);

    Sanctum::actingAs($this->org['budi']);
    $this->deleteJson("/api/v1/pengumuman/{$mine->id}")->assertForbidden(); // addressed to all → visible → 403

    Sanctum::actingAs($this->org['hr']);
    $this->deleteJson("/api/v1/pengumuman/{$mine->id}")->assertNoContent();

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/pengumuman/spanduk')->assertJsonPath('total', 0);
    $this->getJson("/api/v1/pengumuman/{$mine->id}")->assertNotFound();
    expect(Announcement::query()->count())->toBe(0)->and(Announcement::withTrashed()->count())->toBe(1);

    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/pengumuman?tab=saya-buat')->assertJsonCount(0, 'items');
});

test('audiences depend on the role: all for HR, own division for a head, own team for a lead', function () {
    Sanctum::actingAs($this->org['hr']);
    $this->getJson('/api/v1/pengumuman/audiens')->assertOk()
        ->assertJsonPath('audiences', [
            ['value' => 'all', 'label' => 'Semua karyawan'],
            ['value' => 'division', 'label' => 'Divisi tertentu'],
            ['value' => 'team', 'label' => 'Tim tertentu'],
        ])
        ->assertJsonCount(2, 'divisions')
        ->assertJsonCount(1, 'teams');

    Sanctum::actingAs($this->org['kadiv']);
    $this->getJson('/api/v1/pengumuman/audiens')->assertOk()
        ->assertJsonPath('audiences', [['value' => 'division', 'label' => 'Divisi tertentu']])
        ->assertJsonPath('divisions', [['id' => $this->org['ops']->id, 'name' => 'Operasional']])
        ->assertJsonPath('teams', []);

    Sanctum::actingAs($this->org['sari']);
    $this->getJson('/api/v1/pengumuman/audiens')->assertOk()
        ->assertJsonPath('audiences', [['value' => 'team', 'label' => 'Tim tertentu']])
        ->assertJsonPath('teams', [['id' => $this->org['gudang']->id, 'name' => 'Tim Gudang']]);

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/pengumuman/audiens')->assertForbidden();
});

test('announcements need a token', function () {
    $this->getJson('/api/v1/pengumuman')->assertUnauthorized();
    $this->postJson('/api/v1/pengumuman', [])->assertUnauthorized();
    $this->getJson('/api/v1/pengumuman/spanduk')->assertUnauthorized();
});
