<?php

use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Chat\Actions\SyncWorkspaceChannel;
use App\Domain\Chat\Notifications\ChatMentionNotification;
use App\Domain\Tasks\Actions\CreateTask;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\DriveFile;
use App\Models\Message;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — B3-C Obrolan: thread, sunting/hapus/reaksi, buat DM/grup/kanal,
| jelajah & gabung, bisu, detail & anggota, "dibaca oleh", cari, mention dan
| rujukan tugas. Controller tipis di atas Action/Policy web, di balik flag
| features.chat (404 saat mati).
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.chat' => true]);
    Notification::fake();

    $this->dimas = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->sari = User::factory()->create(['name' => 'Sari Wulandari']);
    $this->maya = User::factory()->create(['name' => 'Maya Lestari']);
    $this->luar = User::factory()->create(['name' => 'Orang Luar']);

    $this->dm = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id]);
    $this->grup = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id, $this->maya->id]);
    $this->umum = Channel::factory()->publicChannel()->withMembers([$this->dimas, $this->sari])->create(['name' => 'umum', 'topic' => 'Info kantor']);
    $this->privat = Channel::factory()->privateChannel()->withMembers([$this->dimas])->create(['name' => 'rapat-direksi']);
});

function sebagaiB3c(User $user): void
{
    app(Factory::class)->forgetGuards();
    Sanctum::actingAs($user);
}

function kirimB3c(Channel $channel, User $author, string $text, ?Message $parent = null): Message
{
    return app(PostMessage::class)->handle($channel, $author, richDoc($text), [], $parent);
}

test('the list carries titles, member names for DMs, is_member and unread totals under both paths', function () {
    kirimB3c($this->dm, $this->sari, 'Laporan sudah saya kirim');
    kirimB3c($this->umum, $this->sari, 'Info baru');
    sebagaiB3c($this->dimas);

    foreach (['/api/v1/obrolan', '/api/v1/obrolan/kanal'] as $path) {
        $response = $this->getJson($path)->assertOk();
        $channels = collect($response->json('channels'));

        $dm = $channels->firstWhere('id', $this->dm->id);
        $grup = $channels->firstWhere('id', $this->grup->id);
        $umum = $channels->firstWhere('id', $this->umum->id);

        expect($dm['title'])->toBe('Sari Wulandari')
            ->and($dm['members'][0])->toHaveKeys(['user_id', 'name', 'initials'])
            ->and($grup['title'])->toBe('Maya, Sari')
            ->and($umum['title'])->toBe('#umum')
            ->and($umum['is_member'])->toBeTrue()
            ->and($umum['members_count'])->toBe(2)
            ->and($umum['members'][0])->not->toHaveKey('name')
            ->and($channels->pluck('id'))->toContain($this->privat->id)
            ->and($response->json('unread_total'))->toBe(2)
            ->and($response->json('unread_channels'))->toBe(2);
    }
});

test('message rows carry the author, the can flags and the deleted flag', function () {
    $mine = kirimB3c($this->umum, $this->dimas, 'Pesan saya');
    $theirs = kirimB3c($this->umum, $this->sari, 'Pesan Sari');
    $gone = kirimB3c($this->umum, $this->sari, 'Akan hilang');
    $this->actingAs($this->sari)->deleteJson("/obrolan/pesan/{$gone->id}")->assertOk();
    sebagaiB3c($this->dimas);

    $rows = collect($this->getJson("/api/v1/obrolan/{$this->umum->id}/pesan")->assertOk()->json('messages'))->keyBy('id');

    expect($rows[$mine->id]['author'])->toBe(['id' => $this->dimas->id, 'name' => 'Dimas Pratama', 'initials' => 'DP'])
        ->and($rows[$mine->id]['penulis']['nama'])->toBe('Dimas Pratama')
        ->and($rows[$mine->id]['can'])->toBe(['edit' => true, 'delete' => true, 'react' => true, 'reply' => true])
        // Dimas is the channel owner: he may moderate, but not edit Sari's words.
        ->and($rows[$theirs->id]['can'])->toBe(['edit' => false, 'delete' => true, 'react' => true, 'reply' => true])
        ->and($rows[$gone->id]['deleted'])->toBeTrue()
        ->and($rows[$gone->id]['deleted_label'])->toBe('Pesan ini dihapus')
        ->and($rows[$gone->id]['body_text'])->toBe('')
        ->and($rows[$gone->id]['can'])->toBe(['edit' => false, 'delete' => false, 'react' => false, 'reply' => false])
        ->and($rows[$mine->id]['deleted'])->toBeFalse();
});

test('a reply keeps the thread summary of its root and the replies endpoint pages', function () {
    $root = kirimB3c($this->umum, $this->dimas, 'Usulan awal');
    sebagaiB3c($this->sari);

    $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", ['body' => 'Setuju', 'parent_id' => $root->id])
        ->assertCreated()
        ->assertJsonPath('message.parent_id', $root->id)
        ->assertJsonPath('message.can.reply', false);
    $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", ['body' => 'Tambahan', 'parent_id' => $root->id])->assertCreated();
    $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", ['body' => 'Terakhir', 'parent_id' => $root->id])->assertCreated();

    $timeline = collect($this->getJson("/api/v1/obrolan/{$this->umum->id}/pesan")->assertOk()->json('messages'));
    $rootRow = $timeline->firstWhere('id', $root->id);

    expect($rootRow['reply_count'])->toBe(3)
        ->and($rootRow['last_reply_at'])->toBeString()
        ->and($rootRow['participants'])->toHaveCount(1)
        ->and($rootRow['participants'][0]['name'])->toBe('Sari Wulandari');

    $page1 = $this->getJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$root->id}/balasan?per_page=2")->assertOk();
    expect($page1->json('root.id'))->toBe($root->id)
        ->and($page1->json('replies'))->toHaveCount(2)
        ->and($page1->json('has_more'))->toBeTrue()
        ->and($page1->json('replies.0.body_text'))->toBe('Setuju');

    $page2 = $this->getJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$root->id}/balasan?per_page=2&setelah=".$page1->json('next_cursor'))->assertOk();
    expect($page2->json('replies'))->toHaveCount(1)
        ->and($page2->json('replies.0.body_text'))->toBe('Terakhir')
        ->and($page2->json('has_more'))->toBeFalse()
        ->and($page2->json('next_cursor'))->toBeNull();

    // A reply is not a thread root, and a root of another channel is not found here.
    $reply = Message::query()->where('parent_id', $root->id)->first();
    $this->getJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$reply->id}/balasan")->assertNotFound();
    $this->getJson("/api/v1/obrolan/{$this->grup->id}/pesan/{$root->id}/balasan")->assertNotFound();

    // Replying to a reply or to a foreign root is a validation error.
    $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", ['body' => 'Salah', 'parent_id' => $reply->id])
        ->assertUnprocessable()->assertJsonValidationErrors('parent_id');
    $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", ['body' => 'Salah', 'parent_id' => '01JABCDEFGHJKMNPQRSTVWXYZ0'])
        ->assertUnprocessable()->assertJsonPath('errors.parent_id.0', 'Pesan utama tidak ditemukan.');
});

test('a deleted thread root still lists its replies', function () {
    $root = kirimB3c($this->umum, $this->dimas, 'Induk');
    kirimB3c($this->umum, $this->sari, 'Balasan bertahan', $root);
    sebagaiB3c($this->dimas);

    $this->deleteJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$root->id}")->assertOk()->assertJsonPath('message.deleted', true);

    $this->getJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$root->id}/balasan")
        ->assertOk()
        ->assertJsonPath('root.deleted_label', 'Pesan ini dihapus')
        ->assertJsonPath('replies.0.body_text', 'Balasan bertahan');
});

test('only the author edits; the author or a moderator deletes', function () {
    $sari = kirimB3c($this->umum, $this->sari, 'Tulisan Sari');
    sebagaiB3c($this->sari);

    $this->patchJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$sari->id}", ['body' => 'Tulisan Sari (revisi)'])
        ->assertOk()
        ->assertJsonPath('message.body_text', 'Tulisan Sari (revisi)')
        ->assertJsonPath('message.edited_at', fn ($value) => is_string($value));

    $this->patchJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$sari->id}", ['body' => '   '])
        ->assertUnprocessable()
        ->assertJsonPath('errors.body.0', 'Pesan tidak boleh kosong. Hapus pesan bila tidak diperlukan lagi.');

    // Dimas (channel owner) cannot edit Sari's message but may delete it.
    sebagaiB3c($this->dimas);
    $this->patchJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$sari->id}", ['body' => 'Dipalsukan'])->assertForbidden();

    // A plain member cannot delete someone else's message.
    $dimas = kirimB3c($this->umum, $this->dimas, 'Tulisan Dimas');
    sebagaiB3c($this->sari);
    $this->deleteJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$dimas->id}")->assertForbidden();

    sebagaiB3c($this->dimas);
    $this->deleteJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$sari->id}")
        ->assertOk()
        ->assertJsonPath('message.deleted', true);

    // A deleted message is gone for edit/react.
    $this->patchJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$sari->id}", ['body' => 'Hidup lagi'])->assertNotFound();

    // A message of another channel is not reachable through this channel's path.
    $other = kirimB3c($this->grup, $this->dimas, 'Di grup');
    $this->patchJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$other->id}", ['body' => 'Silang'])->assertNotFound();
});

test('reactions are idempotent and limited to the fixed emoji', function () {
    $message = kirimB3c($this->umum, $this->dimas, 'Rapat jam 3');
    sebagaiB3c($this->sari);
    $url = "/api/v1/obrolan/{$this->umum->id}/pesan/{$message->id}/reaksi";

    $this->postJson($url, ['emoji' => '👍'])->assertOk()
        ->assertJsonPath('reacted', true)
        ->assertJsonPath('message.reaction_summary', [['emoji' => '👍', 'count' => 1, 'mine' => true]]);
    // Retrying the same call does not flip it back.
    $this->postJson($url, ['emoji' => '👍'])->assertOk()->assertJsonPath('message.reaction_summary.0.count', 1);

    sebagaiB3c($this->dimas);
    $this->postJson($url, ['emoji' => '👍'])->assertOk()
        ->assertJsonPath('message.reaction_summary', [['emoji' => '👍', 'count' => 2, 'mine' => true]]);

    $this->deleteJson($url, ['emoji' => '👍'])->assertOk()
        ->assertJsonPath('reacted', false)
        ->assertJsonPath('message.reaction_summary', [['emoji' => '👍', 'count' => 1, 'mine' => false]]);
    $this->deleteJson($url, ['emoji' => '👍'])->assertOk()->assertJsonPath('message.reaction_summary.0.count', 1);

    $this->postJson($url, ['emoji' => '💩'])->assertUnprocessable()->assertJsonValidationErrors('emoji');
});

test('opening a DM or group reuses the conversation and enforces the size', function () {
    sebagaiB3c($this->dimas);

    $first = $this->postJson('/api/v1/obrolan', ['jenis' => 'langsung', 'user_ids' => [$this->maya->id]])
        ->assertCreated()
        ->assertJsonPath('created', true)
        ->assertJsonPath('channel.type', 'dm')
        ->assertJsonPath('channel.title', 'Maya Lestari');

    $this->postJson('/api/v1/obrolan', ['jenis' => 'langsung', 'user_ids' => [$this->maya->id]])
        ->assertOk()
        ->assertJsonPath('created', false)
        ->assertJsonPath('id', $first->json('id'));

    // Same people as the existing group: the existing group comes back.
    $this->postJson('/api/v1/obrolan', ['jenis' => 'langsung', 'user_ids' => [$this->sari->id, $this->maya->id]])
        ->assertOk()
        ->assertJsonPath('id', $this->grup->id)
        ->assertJsonPath('channel.type', 'group')
        ->assertJsonPath('channel.title', 'Maya, Sari');

    $luar = $this->postJson('/api/v1/obrolan', ['jenis' => 'langsung', 'user_ids' => [$this->luar->id, $this->sari->id, $this->maya->id]])
        ->assertCreated();
    expect($luar->json('channel.members_count'))->toBe(4);

    $many = User::factory()->count(9)->create()->pluck('id')->all();
    $this->postJson('/api/v1/obrolan', ['jenis' => 'langsung', 'user_ids' => $many])
        ->assertUnprocessable()->assertJsonValidationErrors('user_ids');
    $this->postJson('/api/v1/obrolan', ['jenis' => 'langsung', 'user_ids' => []])
        ->assertUnprocessable()->assertJsonPath('errors.user_ids.0', 'Pilih minimal satu orang.');
    $this->postJson('/api/v1/obrolan', ['jenis' => 'langsung', 'user_ids' => [$this->dimas->id]])
        ->assertUnprocessable()->assertJsonValidationErrors('user_ids');
    $this->postJson('/api/v1/obrolan', ['jenis' => 'aneh'])->assertUnprocessable()->assertJsonValidationErrors('jenis');
});

test('a channel is created public or private with its owner and invited members', function () {
    sebagaiB3c($this->dimas);

    $public = $this->postJson('/api/v1/obrolan', ['jenis' => 'kanal', 'name' => 'Tim Konten Q4', 'topic' => 'Kalender konten'])
        ->assertCreated()
        ->assertJsonPath('channel.type', 'public')
        ->assertJsonPath('channel.name', 'tim-konten-q4')
        ->assertJsonPath('channel.title', '#tim-konten-q4')
        ->assertJsonPath('channel.my_role', 'owner')
        ->assertJsonPath('channel.topic', 'Kalender konten');
    expect($public->json('channel.can_manage'))->toBeTrue();

    $private = $this->postJson('/api/v1/obrolan', ['jenis' => 'kanal', 'name' => 'Rahasia', 'private' => true, 'member_ids' => [$this->sari->id]])
        ->assertCreated()
        ->assertJsonPath('channel.type', 'private')
        ->assertJsonPath('channel.members_count', 2);

    // Invited members see it; strangers get 404.
    sebagaiB3c($this->sari);
    $this->getJson('/api/v1/obrolan/'.$private->json('id'))->assertOk();
    sebagaiB3c($this->luar);
    $this->getJson('/api/v1/obrolan/'.$private->json('id'))->assertNotFound();

    sebagaiB3c($this->dimas);
    $this->postJson('/api/v1/obrolan', ['jenis' => 'kanal', 'name' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson('/api/v1/obrolan', ['jenis' => 'kanal'])->assertUnprocessable()->assertJsonPath('errors.name.0', 'Nama channel wajib diisi.');
});

test('browsing lists active public channels and joining is explicit and idempotent', function () {
    $sepi = Channel::factory()->publicChannel()->create(['name' => 'olahraga', 'topic' => 'Futsal Jumat']);
    Channel::factory()->publicChannel()->create(['name' => 'lama', 'archived_at' => now()]);
    kirimB3c($this->umum, $this->dimas, 'Halo semua');
    sebagaiB3c($this->maya);

    $response = $this->getJson('/api/v1/obrolan/kanal-publik')->assertOk();
    $byName = collect($response->json('channels'))->keyBy('name');

    expect($byName->keys()->all())->toBe(['olahraga', 'umum'])
        ->and($byName['umum']['members_count'])->toBe(2)
        ->and($byName['umum']['is_member'])->toBeFalse()
        ->and($byName['umum']['last_message_at'])->toBeString()
        ->and($byName['olahraga']['last_message_at'])->toBeNull()
        ->and($response->json('meta'))->toBe(['page' => 1, 'per_page' => 30, 'total' => 2, 'has_more' => false]);

    $this->getJson('/api/v1/obrolan/kanal-publik?q=futsal')->assertOk()->assertJsonCount(1, 'channels');

    $this->postJson("/api/v1/obrolan/{$sepi->id}/gabung")
        ->assertCreated()
        ->assertJsonPath('joined', true)
        ->assertJsonPath('channel.is_member', true)
        ->assertJsonPath('channel.my_role', 'member');
    $this->postJson("/api/v1/obrolan/{$sepi->id}/gabung")->assertOk()->assertJsonPath('joined', false);

    // Only public channels can be joined; private ones are invisible (404).
    $this->postJson("/api/v1/obrolan/{$this->privat->id}/gabung")->assertNotFound();
    $this->postJson("/api/v1/obrolan/{$this->grup->id}/gabung")
        ->assertUnprocessable()->assertJsonPath('errors.channel.0', 'Hanya channel publik yang bisa digabung.');
});

test('the detail lists members with roles and the viewer state', function () {
    sebagaiB3c($this->dimas);

    $this->getJson("/api/v1/obrolan/{$this->umum->id}")
        ->assertOk()
        ->assertJsonPath('channel.type', 'public')
        ->assertJsonPath('channel.topic', 'Info kantor')
        ->assertJsonPath('channel.my_role', 'owner')
        ->assertJsonPath('channel.muted', false)
        ->assertJsonPath('channel.archived', false)
        ->assertJsonPath('channel.members_count', 2)
        ->assertJsonPath('channel.members.0.name', 'Dimas Pratama')
        ->assertJsonPath('channel.members.0.role', 'owner')
        ->assertJsonPath('channel.members.1.role_label', 'Anggota')
        ->assertJsonPath('channel.workspace', null);

    $this->getJson("/api/v1/obrolan/{$this->umum->id}/anggota?per_page=1")
        ->assertOk()
        ->assertJsonCount(1, 'members')
        ->assertJsonPath('meta', ['page' => 1, 'per_page' => 1, 'total' => 2, 'has_more' => true]);
    $this->getJson("/api/v1/obrolan/{$this->umum->id}/anggota?per_page=1&page=2")
        ->assertOk()
        ->assertJsonPath('members.0.name', 'Sari Wulandari')
        ->assertJsonPath('meta.has_more', false);

    // Non-members cannot see private conversations at all.
    sebagaiB3c($this->luar);
    $this->getJson("/api/v1/obrolan/{$this->privat->id}")->assertNotFound();
    $this->getJson("/api/v1/obrolan/{$this->dm->id}/anggota")->assertNotFound();
});

test('the workspace channel detail links its workspace and is read-only for non-members', function () {
    $workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'PLQ', 'name' => 'Peluncuran']);
    app(SyncWorkspaceChannel::class)->handle($workspace);
    $channel = Channel::query()->where('workspace_id', $workspace->id)->firstOrFail();
    sebagaiB3c($this->dimas);

    $this->getJson("/api/v1/obrolan/{$channel->id}")
        ->assertOk()
        ->assertJsonPath('channel.type', 'workspace')
        ->assertJsonPath('channel.workspace.key', 'PLQ')
        ->assertJsonPath('channel.workspace.url', '/w/PLQ')
        ->assertJsonPath('channel.can_post', true);
});

test('muting is a PATCH of the own membership', function () {
    sebagaiB3c($this->sari);

    $this->patchJson("/api/v1/obrolan/{$this->grup->id}/bisu", ['muted' => true])->assertOk()->assertJsonPath('muted', true);
    expect(ChannelMember::query()->where('channel_id', $this->grup->id)->where('user_id', $this->sari->id)->value('muted'))->toBeTrue();

    $this->getJson("/api/v1/obrolan/{$this->grup->id}")->assertJsonPath('channel.muted', true);
    $this->patchJson("/api/v1/obrolan/{$this->grup->id}/bisu", ['muted' => false])->assertOk()->assertJsonPath('muted', false);
    $this->patchJson("/api/v1/obrolan/{$this->grup->id}/bisu", [])->assertUnprocessable()->assertJsonValidationErrors('muted');

    sebagaiB3c($this->luar);
    $this->patchJson("/api/v1/obrolan/{$this->grup->id}/bisu", ['muted' => true])->assertNotFound();
});

test('read-by lists who has read up to a message, names only', function () {
    $message = kirimB3c($this->grup, $this->dimas, 'Siapa yang ikut?');
    sebagaiB3c($this->maya);
    $this->postJson("/api/v1/obrolan/{$this->grup->id}/dibaca")->assertOk();
    $url = "/api/v1/obrolan/{$this->grup->id}/dibaca-oleh/{$message->id}";

    sebagaiB3c($this->dimas);
    $this->getJson($url)
        ->assertOk()
        ->assertJsonPath('message_id', $message->id)
        ->assertJsonPath('recipients_count', 2)
        ->assertJsonPath('read_count', 1)
        ->assertJsonPath('readers', [['id' => $this->maya->id, 'name' => 'Maya Lestari', 'initials' => 'ML']]);

    // The author is never in the list; strangers cannot ask.
    sebagaiB3c($this->luar);
    $this->getJson($url)->assertNotFound();

    // Non-members of a public channel read the channel but not its receipts.
    $public = kirimB3c($this->umum, $this->dimas, 'Info');
    $this->getJson("/api/v1/obrolan/{$this->umum->id}/dibaca-oleh/{$public->id}")
        ->assertForbidden();
});

test('in-channel search matches word prefixes, skips deleted messages and stays inside members', function () {
    $hit = kirimB3c($this->umum, $this->sari, 'Rapat evaluasi anggaran besok');
    kirimB3c($this->umum, $this->sari, 'Makan siang bersama');
    $gone = kirimB3c($this->umum, $this->sari, 'Rapat dibatalkan');
    $this->actingAs($this->sari)->deleteJson("/obrolan/pesan/{$gone->id}")->assertOk();
    kirimB3c($this->grup, $this->dimas, 'Rapat rahasia grup');
    sebagaiB3c($this->dimas);

    $response = $this->getJson("/api/v1/obrolan/{$this->umum->id}/cari?q=rapat%20ang")->assertOk();
    expect($response->json('messages'))->toHaveCount(1)
        ->and($response->json('messages.0.id'))->toBe($hit->id)
        ->and($response->json('messages.0.author.name'))->toBe('Sari Wulandari')
        ->and($response->json('has_more'))->toBeFalse()
        ->and($response->json('query'))->toBe('rapat ang');

    $this->getJson("/api/v1/obrolan/{$this->umum->id}/cari?q=zzzz")->assertOk()->assertJsonCount(0, 'messages');
    $this->getJson("/api/v1/obrolan/{$this->umum->id}/cari?q=r")->assertUnprocessable()->assertJsonValidationErrors('q');
    $this->getJson("/api/v1/obrolan/{$this->umum->id}/cari")->assertUnprocessable();
    // Characters that would break a tsquery are harmless.
    $this->getJson("/api/v1/obrolan/{$this->umum->id}/cari?q=".urlencode("rapat' & | ! ("))->assertOk();

    sebagaiB3c($this->luar);
    $this->getJson("/api/v1/obrolan/{$this->grup->id}/cari?q=rapat")->assertNotFound();
});

test('typed @names and resolved ids become real mentions that notify readers of the channel', function () {
    sebagaiB3c($this->dimas);

    $response = $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", [
        'body' => "Halo @Sari Wulandari, cek ini\nsoal anggaran",
        'mentions' => [$this->sari->id],
    ])->assertCreated();

    $body = $response->json('message.body');
    expect($body['content'][0]['content'][1])->toBe(['type' => 'mention', 'attrs' => ['id' => $this->sari->id, 'label' => 'Sari Wulandari']])
        ->and($body['content'][1]['content'][0]['text'])->toBe('soal anggaran')
        ->and($response->json('message.body_text'))->toBe("Halo @Sari Wulandari, cek ini\nsoal anggaran")
        ->and($response->json('message.mentions'))->toBe([['user_id' => $this->sari->id, 'name' => 'Sari Wulandari']]);
    Notification::assertSentTo($this->sari, ChatMentionNotification::class);

    // A mentioned id whose name is not typed is appended at the end.
    $second = $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", ['body' => 'Mohon dicek', 'mentions' => [$this->sari->id]])->assertCreated();
    expect($second->json('message.body_text'))->toBe('Mohon dicek @Sari Wulandari');

    // Someone who cannot read the private channel stays plain text and is never notified.
    $private = $this->postJson("/api/v1/obrolan/{$this->privat->id}/pesan", ['body' => 'Hai @Orang Luar', 'mentions' => [$this->luar->id]])->assertCreated();
    expect($private->json('message.mentions'))->toBe([])
        ->and(json_encode($private->json('message.body')))->not->toContain('"mention"');
    Notification::assertNotSentTo($this->luar, ChatMentionNotification::class);

    // Editing keeps the mention syntax working.
    $this->patchJson("/api/v1/obrolan/{$this->umum->id}/pesan/{$response->json('message.id')}", [
        'body' => 'Halo @Sari Wulandari (revisi)',
        'mentions' => [$this->sari->id],
    ])->assertOk()->assertJsonPath('message.mentions.0.name', 'Sari Wulandari');
});

test('#KEY-n tokens with task_refs become task references; hidden tasks stay text', function () {
    $workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'PLQ']);
    $task = app(CreateTask::class)->handle($workspace, $this->dimas, ['title' => 'Siapkan materi peluncuran']);
    $hidden = Workspace::factory()->ownedBy($this->sari)->create(['key' => 'RHS']);
    $secret = app(CreateTask::class)->handle($hidden, $this->sari, ['title' => 'Rahasia']);
    sebagaiB3c($this->dimas);

    $response = $this->postJson("/api/v1/obrolan/{$this->umum->id}/pesan", [
        'body' => 'Lihat #PLQ-'.$task->number.' dan #RHS-'.$secret->number,
        'task_refs' => [$task->id, $secret->id],
    ])->assertCreated();

    expect(json_encode($response->json('message.body')))->toContain('"taskReference"')
        ->and(json_encode($response->json('message.body')))->toContain($task->id)
        ->and(json_encode($response->json('message.body')))->not->toContain($secret->id)
        ->and($response->json('tasks.0.key'))->toBe('PLQ-'.$task->number);

    $this->getJson('/api/v1/obrolan/rujukan/tugas?q=PLQ-'.$task->number)
        ->assertOk()
        ->assertJsonPath('tasks.0.id', $task->id);
    $this->getJson('/api/v1/obrolan/rujukan/tugas?q=Rahasia')->assertOk()->assertJsonCount(0, 'tasks');
});

test('Drive files attach from the cache when every reader can open them; no Google call is involved', function () {
    $shared = Workspace::factory()->ownedBy($this->dimas)->withMember($this->sari)->create(['key' => 'BRS']);
    $mine = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'SAYA']);
    $sharedFile = DriveFile::factory()->create(['workspace_id' => $shared->id, 'name' => 'Anggaran.xlsx']);
    $privateFile = DriveFile::factory()->create(['workspace_id' => $mine->id]);
    sebagaiB3c($this->dimas);

    $this->getJson("/api/v1/obrolan/{$this->dm->id}/file-drive?q=Anggaran")
        ->assertOk()
        ->assertJsonCount(1, 'files')
        ->assertJsonPath('files.0.id', $sharedFile->id);

    $response = $this->postJson("/api/v1/obrolan/{$this->dm->id}/pesan", ['attachments' => [$sharedFile->id]])->assertCreated();
    expect($response->json('message.attachments'))->toHaveCount(1)
        ->and($response->json('message.attachments.0.name'))->toBe('Anggaran.xlsx')
        ->and($response->json('message.attachments.0.web_view_link'))->toBeString();

    $this->postJson("/api/v1/obrolan/{$this->dm->id}/pesan", ['body' => 'Ini', 'attachments' => [$privateFile->id]])
        ->assertUnprocessable()->assertJsonValidationErrors('attachments');
    $this->postJson("/api/v1/obrolan/{$this->dm->id}/pesan", [])
        ->assertUnprocessable()->assertJsonPath('errors.body.0', 'Pesan tidak boleh kosong.');
});

test('the old paths and the new aliases serve the same timeline and read pointer', function () {
    kirimB3c($this->dm, $this->sari, 'Halo');
    sebagaiB3c($this->dimas);

    $old = $this->getJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan")->assertOk()->json('messages');
    $new = $this->getJson("/api/v1/obrolan/{$this->dm->id}/pesan")->assertOk()->json('messages');
    expect(array_column($new, 'id'))->toBe(array_column($old, 'id'));

    $this->postJson("/api/v1/obrolan/{$this->dm->id}/dibaca")->assertOk();
    expect(collect($this->getJson('/api/v1/obrolan')->json('channels'))->firstWhere('id', $this->dm->id)['unread_count'])->toBe(0);
});

test('every new endpoint answers 404 while the chat flag is off and 401 without a token', function () {
    $paths = [
        ['get', '/api/v1/obrolan'],
        ['post', '/api/v1/obrolan'],
        ['get', '/api/v1/obrolan/kanal-publik'],
        ['get', "/api/v1/obrolan/{$this->umum->id}"],
        ['get', "/api/v1/obrolan/{$this->umum->id}/anggota"],
        ['post', "/api/v1/obrolan/{$this->umum->id}/gabung"],
        ['patch', "/api/v1/obrolan/{$this->umum->id}/bisu"],
        ['get', "/api/v1/obrolan/{$this->umum->id}/cari?q=halo"],
        ['get', "/api/v1/obrolan/{$this->umum->id}/pesan"],
    ];

    foreach ($paths as [$method, $path]) {
        app(Factory::class)->forgetGuards();
        $this->{$method.'Json'}($path)->assertUnauthorized();
    }

    sebagaiB3c($this->dimas);
    config(['features.chat' => false]);

    foreach ($paths as [$method, $path]) {
        $this->{$method.'Json'}($path)->assertNotFound();
    }
});

test('sending and mutating share the web limiter and answer 429 as JSON', function () {
    sebagaiB3c($this->sari);
    RateLimiter::clear('messages|user:'.$this->sari->id);

    for ($i = 0; $i < 60; $i++) {
        $this->patchJson("/api/v1/obrolan/{$this->grup->id}/bisu", ['muted' => $i % 2 === 0])->assertOk();
    }

    $this->patchJson("/api/v1/obrolan/{$this->grup->id}/bisu", ['muted' => true])
        ->assertStatus(429)
        ->assertJsonStructure(['message']);
});
