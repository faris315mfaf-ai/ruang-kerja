<?php

namespace Database\Seeders;

use App\Domain\Chat\Actions\SyncWorkspaceChannel;
use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Google\Enums\AttachmentSource;
use App\Domain\Tasks\Services\MentionParser;
use App\Domain\Tasks\Services\RichText;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Attachment;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\DriveFile;
use App\Models\Mention;
use App\Models\Message;
use App\Models\Reaction;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Demo Obrolan (local/testing, idempotent; F2-1): the automatic channels of
 * every shared workspace, #umum (public, muted for Dimas), #acara-peluncuran
 * (private), DMs Dimas–Sari and Dimas–Hendra, the shift group, and a
 * conversation in Divisi Programming for the programmer persona. Content
 * adapted from the front-end prototype (features/chat/fixtures.ts). Rows are
 * written directly: no notifications, broadcasts or Drive jobs.
 */
class ChatDemoSeeder extends Seeder
{
    /** Prototype persona → demo account. */
    private const array PEOPLE = [
        'dimas' => 'kadiv@demo.test',
        'sari' => 'sari.wulandari@demo.test',
        'rizky' => 'anggota@demo.test',
        'maya' => 'maya.lestari@demo.test',
        'hana' => 'hr@demo.test',
        'hendra' => 'direksi@demo.test',
        'nadia' => 'nadia.putri@demo.test',
        'putri' => 'putri.ramadhani@demo.test',
        'yoga' => 'yoga.pratama@demo.test',
        'yudi' => 'yudi.hartono@demo.test',
        'arif' => 'programmer@demo.test',
    ];

    /**
     * [channel, author, day offset, "HH:MM" (office time), text, options]
     * options: ref (id for threads), parent (ref), reactions [emoji => persons],
     * deleted, edited, file (workspace key whose first Drive file is attached).
     *
     * @var list<array{0: string, 1: string, 2: int, 3: string, 4: string, 5?: array<string, mixed>}>
     */
    private const array MESSAGES = [
        ['PLQ', 'putri', -3, '09:12', 'Pagi semua. Anggaran acara sudah final, mohon dicek sebelum Senin ya.', ['reactions' => ['👍' => ['dimas', 'maya']], 'file' => 'PLQ']],
        ['PLQ', 'dimas', -3, '09:20', 'Siap, Bu Putri. Logistik dari Operasional aman, tinggal PLQ-21 vendor panggung.'],
        ['PLQ', 'maya', -3, '15:42', 'Rundown versi terbaru sudah saya unggah. PLQ-14 saya tandai selesai.', ['reactions' => ['🎉' => ['putri', 'dimas', 'rizky']]]],
        ['PLQ', 'maya', 0, '08:31', '@Dimas Pratama draft deck peluncuran untuk PLQ-18 sudah siap direview. Bagian logistik di slide 12–15.', ['ref' => 'deck', 'reactions' => ['👀' => ['dimas']]]],
        ['PLQ', 'dimas', 0, '08:40', 'Terima kasih Maya, saya lihat siang ini.', ['parent' => 'deck']],
        ['PLQ', 'rizky', 0, '08:52', 'Slide 14 jumlah armada masih 3, seharusnya 4 truk ya.', ['parent' => 'deck']],
        ['PLQ', 'maya', 0, '09:05', 'Siap, sudah saya perbaiki 👍', ['parent' => 'deck', 'edited' => true]],
        ['PLQ', 'rizky', 0, '09:14', 'Vendor panggung minta konfirmasi jumlah kursi paling lambat Rabu.'],
        ['PLQ', 'rizky', 0, '09:15', 'Saya usul 180 kursi + 20 cadangan.'],
        ['PLQ', 'putri', 0, '09:48', 'Setuju 200 total. @Rizky Aditya tolong update di PLQ-21 sekalian.', ['reactions' => ['✅' => ['rizky']]]],
        ['PLQ', 'maya', 0, '10:02', 'Saya hapus pesan tadi, salah kirim channel.', ['deleted' => true]],
        ['GDG', 'sari', -1, '16:10', 'Stok opname rak A–C selesai. Rak B ada selisih 4 karton, fotonya menyusul.'],
        ['GDG', 'dimas', -1, '16:25', 'Oke Sari, catat di GDG-48 ya. Besok kita cek bareng.'],
        ['GDG', 'nadia', 0, '07:58', 'Shift pagi sudah lengkap, 6 orang hadir.', ['reactions' => ['🙏' => ['sari', 'dimas']]]],
        ['OPS', 'dimas', -3, '13:00', 'Reminder: draft revisi SOP penerimaan barang (OPS-138) dibahas Rabu pukul 10.00.'],
        ['OPS', 'rizky', -3, '13:06', 'Siap Pak.', ['reactions' => ['👍' => ['dimas']]]],
        ['umum', 'hana', -3, '10:00', 'Selamat pagi rekan-rekan! Jadwal medical check-up tahunan sudah keluar, cek email masing-masing ya.', ['reactions' => ['🙏' => ['rizky', 'sari', 'maya', 'nadia']]]],
        ['umum', 'hendra', 0, '07:30', 'Selamat pagi. Minggu ini fokus kita peluncuran Q4. Terima kasih atas kerja kerasnya.', ['reactions' => ['🚀' => ['putri', 'maya', 'dimas'], '❤️' => ['hana']]]],
        ['umum', 'hana', 0, '08:05', 'Pengingat: batas pengajuan cuti bersama Desember tanggal 15 Oktober.'],
        ['umum', 'maya', 0, '09:30', 'Ada yang ketinggalan payung biru di pantry lantai 2 😄'],
        ['umum', 'nadia', 0, '09:41', 'Punya saya, terima kasih Kak Maya!'],
        ['acara', 'putri', -1, '19:20', 'Channel ini khusus panitia inti, tolong jangan bagikan detail tamu VIP ke luar.'],
        ['acara', 'dimas', 0, '08:00', 'Noted. Transport tamu VIP saya koordinasikan dengan Sari.'],
        ['dm-sari', 'dimas', -1, '17:02', 'Sari, besok bisa ke gudang jam 9 untuk cek rak B?'],
        ['dm-sari', 'sari', -1, '17:10', 'Bisa Pak, saya siapkan datanya.'],
        ['dm-sari', 'dimas', 0, '08:45', 'Saya agak telat, mulai 09.30 ya.'],
        ['dm-sari', 'sari', 0, '09:58', 'Baik Pak. Selisih rak B ternyata salah input, sudah saya koreksi di GDG-48.'],
        ['dm-hendra', 'hendra', -2, '14:00', 'Dimas, tolong siapkan ringkasan kesiapan logistik untuk rapat direksi Selasa.'],
        ['dm-hendra', 'dimas', -2, '14:12', 'Baik Pak, saya kirim Senin siang.'],
        ['shift', 'sari', 0, '07:40', 'Nadia tukar shift dengan Yoga hari Kamis, sudah diajukan ke sistem.'],
        ['shift', 'nadia', 0, '07:44', 'Betul Pak, mohon disetujui 🙏'],
        ['PRG', 'yudi', -1, '09:05', '@Arif Nugroho tolong prioritaskan PRG-103, banyak keluhan login dari pengguna iPhone.', ['reactions' => ['👀' => ['arif']]]],
        ['PRG', 'arif', -1, '09:20', 'Siap Pak, sore ini saya reproduksi di Safari iOS 18.'],
        ['PRG', 'arif', 0, '08:10', 'PRG-98 sudah siap direview, mohon dicek sebelum makan siang.', ['ref' => 'pr']],
        ['PRG', 'yudi', 0, '08:35', 'Oke, saya lihat jam 10.', ['parent' => 'pr']],
    ];

    /** Per persona: messages up to this one are read (unread badges for the rest). */
    private const array READ_UNTIL = [
        'dimas' => ['PLQ' => 3, 'umum' => 1, 'dm-sari' => 2],
    ];

    public function run(SyncWorkspaceChannel $sync): void
    {
        /** @var array<string, User> $people */
        $people = [];

        foreach (self::PEOPLE as $persona => $email) {
            $user = User::query()->where('email', $email)->first();

            if ($user !== null) {
                $people[$persona] = $user;
            }
        }

        Workspace::query()->where('type', '!=', WorkspaceType::Personal->value)->orderBy('id')
            ->each(fn (Workspace $workspace) => $sync->handle($workspace));

        if (! isset($people['dimas']) || Channel::query()->where('type', ChannelType::Public)->where('name', 'umum')->exists()) {
            return; // Organization not seeded, or chat already seeded.
        }

        $channels = $this->channels($people);
        $this->messages($channels, $people);
    }

    /**
     * @param  array<string, User>  $people
     * @return array<string, Channel>
     */
    private function channels(array $people): array
    {
        $channels = [];

        foreach (['PLQ', 'GDG', 'OPS', 'PRG'] as $key) {
            $channel = Channel::query()->where('type', ChannelType::Workspace)
                ->whereIn('workspace_id', Workspace::query()->where('key', $key)->select('id'))
                ->first();

            if ($channel !== null) {
                $channels[$key] = $channel;
            }
        }

        $dimas = $people['dimas'];
        $everyone = array_values($people);

        $channels['umum'] = $this->free($dimas, ChannelType::Public, 'umum', 'Pengumuman & obrolan seluruh kantor', $people['hana'] ?? $dimas, $everyone);
        $channels['acara'] = $this->free($dimas, ChannelType::Private, 'acara-peluncuran', 'Panitia inti peluncuran Q4 (rahasia)', $people['putri'] ?? $dimas, $this->pick($people, ['putri', 'dimas', 'maya', 'sari']));
        $channels['dm-sari'] = $this->direct($dimas, $this->pick($people, ['dimas', 'sari']));
        $channels['dm-hendra'] = $this->direct($dimas, $this->pick($people, ['dimas', 'hendra']));
        $channels['shift'] = $this->direct($dimas, $this->pick($people, ['dimas', 'sari', 'nadia']));

        ChannelMember::query()->where('channel_id', $channels['umum']->id)->where('user_id', $dimas->id)->update(['muted' => true]);

        return $channels;
    }

    /**
     * @param  list<User>  $members
     */
    private function free(User $dimas, ChannelType $type, string $name, string $topic, User $owner, array $members): Channel
    {
        $channel = Channel::query()->create([
            'company_id' => $dimas->company_id,
            'type' => $type,
            'name' => $name,
            'topic' => $topic,
            'created_by' => $owner->id,
            'created_at' => now()->subDays(30),
        ]);

        foreach ($members as $member) {
            $this->member($channel, $member, $member->id === $owner->id ? ChannelRole::Owner : ChannelRole::Member);
        }

        return $channel;
    }

    /**
     * @param  list<User>  $members
     */
    private function direct(User $dimas, array $members): Channel
    {
        $channel = Channel::query()->create([
            'company_id' => $dimas->company_id,
            'type' => count($members) > 2 ? ChannelType::Group : ChannelType::Dm,
            'name' => null,
            'direct_key' => Channel::directKey(array_map(fn (User $user): string => $user->id, $members)),
            'created_by' => $dimas->id,
            'created_at' => now()->subDays(20),
        ]);

        foreach ($members as $member) {
            $this->member($channel, $member, ChannelRole::Member);
        }

        return $channel;
    }

    private function member(Channel $channel, User $user, ChannelRole $role): void
    {
        ChannelMember::query()->insertOrIgnore([
            'channel_id' => $channel->id,
            'user_id' => $user->id,
            'role' => $role->value,
            'muted' => false,
            'joined_at' => now()->subDays(20),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, Channel>  $channels
     * @param  array<string, User>  $people
     */
    private function messages(array $channels, array $people): void
    {
        $refs = [];
        $counts = [];
        $lastIds = [];
        $today = CarbonImmutable::now(config()->string('app.office_timezone'))->startOfDay();
        $mentionable = array_map(fn (User $user): string => $user->name, $people);

        foreach (self::MESSAGES as $row) {
            [$key, $persona, $day, $time, $text] = $row;
            $options = $row[5] ?? [];
            $channel = $channels[$key] ?? null;
            $author = $people[$persona] ?? null;

            if ($channel === null || $author === null) {
                continue;
            }

            [$hour, $minute] = array_map('intval', explode(':', $time));
            $at = $today->addDays($day)->setTime($hour, $minute)->utc();
            $deleted = ($options['deleted'] ?? false) === true;
            $document = $deleted ? null : $this->document($text, $people, $mentionable);

            $message = new Message;
            $message->forceFill([
                'id' => strtolower((string) Str::ulid($at)),
                'channel_id' => $channel->id,
                'user_id' => $author->id,
                'parent_id' => isset($options['parent']) ? ($refs[$options['parent']] ?? null) : null,
                'body' => $document,
                'body_text' => $deleted ? '' : (RichText::toText($document) ?? $text),
                'edited_at' => ($options['edited'] ?? false) ? $at->addMinutes(4) : null,
                'created_at' => $at,
                'updated_at' => $at,
                'deleted_at' => $deleted ? $at->addMinutes(2) : null,
            ])->saveQuietly();

            if (isset($options['ref'])) {
                $refs[$options['ref']] = $message->id;
            }

            if ($message->parent_id === null) {
                $counts[$key] = ($counts[$key] ?? 0) + 1;
                $lastIds[$key][$counts[$key]] = $message->id;
            }

            $this->extras($message, $options, $people, $document, $author, $at);
        }

        $this->readPointers($channels, $people, $lastIds);
    }

    /**
     * @param  array<string, mixed>  $options
     * @param  array<string, User>  $people
     * @param  array<string, mixed>|null  $document
     */
    private function extras(Message $message, array $options, array $people, ?array $document, User $author, CarbonImmutable $at): void
    {
        /** @var array<string, list<string>> $reactions */
        $reactions = $options['reactions'] ?? [];

        foreach ($reactions as $emoji => $personas) {
            foreach ($personas as $persona) {
                if (isset($people[$persona])) {
                    Reaction::query()->insertOrIgnore([
                        'id' => strtolower((string) Str::ulid()),
                        'reactable_type' => $message->getMorphClass(),
                        'reactable_id' => $message->id,
                        'user_id' => $people[$persona]->id,
                        'emoji' => $emoji,
                        'created_at' => $at->addMinutes(5),
                    ]);
                }
            }
        }

        foreach (app(MentionParser::class)->userIds($document) as $userId) {
            Mention::query()->insertOrIgnore([
                'id' => strtolower((string) Str::ulid()),
                'mentionable_type' => $message->getMorphClass(),
                'mentionable_id' => $message->id,
                'mentioned_user_id' => $userId,
                'created_by' => $author->id,
                'created_at' => $at,
            ]);
        }

        if (isset($options['file']) && is_string($options['file'])) {
            $file = DriveFile::query()->whereIn('workspace_id', Workspace::query()->where('key', $options['file'])->select('id'))->orderBy('name')->first();

            if ($file !== null) {
                Attachment::query()->create([
                    'attachable_type' => $message->getMorphClass(),
                    'attachable_id' => $message->id,
                    'source' => AttachmentSource::Drive,
                    'drive_file_id' => $file->id,
                    'filename' => $file->name,
                    'mime_type' => $file->mime_type,
                    'size_bytes' => $file->size_bytes,
                    'uploaded_by' => $author->id,
                ]);
            }
        }
    }

    /**
     * Everyone has read everything, except the counts in READ_UNTIL.
     *
     * @param  array<string, Channel>  $channels
     * @param  array<string, User>  $people
     * @param  array<string, array<int, string>>  $lastIds
     */
    private function readPointers(array $channels, array $people, array $lastIds): void
    {
        foreach ($channels as $key => $channel) {
            $latest = $channel->messages()->withTrashed()->max('id');

            if (! is_string($latest)) {
                continue;
            }

            ChannelMember::query()->where('channel_id', $channel->id)->update(['last_read_message_id' => $latest]);

            foreach (self::READ_UNTIL as $persona => $limits) {
                if (isset($limits[$key], $people[$persona], $lastIds[$key][$limits[$key]])) {
                    ChannelMember::query()
                        ->where('channel_id', $channel->id)
                        ->where('user_id', $people[$persona]->id)
                        ->update(['last_read_message_id' => $lastIds[$key][$limits[$key]]]);
                }
            }
        }
    }

    /**
     * Plain text with "@Full Name" and "KEY-n" → sanitized Tiptap document.
     *
     * @param  array<string, User>  $people
     * @param  array<string, string>  $mentionable  persona => name
     * @return array<string, mixed>|null
     */
    private function document(string $text, array $people, array $mentionable): ?array
    {
        $names = array_map(fn (string $name): string => preg_quote($name, '/'), array_values($mentionable));
        $pattern = '/(@(?:'.implode('|', $names).')|\b[A-Z]{2,5}-\d+\b)/u';
        $parts = preg_split($pattern, $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [$text];
        $inline = [];
        $peopleIds = [];
        $taskIds = [];
        $byName = [];

        foreach ($people as $user) {
            $byName[$user->name] = $user;
        }

        foreach ($parts as $part) {
            if (str_starts_with($part, '@') && isset($byName[substr($part, 1)])) {
                $user = $byName[substr($part, 1)];
                $peopleIds[$user->id] = $user->name;
                $inline[] = ['type' => 'mention', 'attrs' => ['id' => $user->id, 'label' => $user->name]];

                continue;
            }

            if (preg_match('/^([A-Z]{2,5})-(\d+)$/', $part, $match) === 1) {
                $task = Task::query()
                    ->whereIn('workspace_id', Workspace::query()->where('key', $match[1])->select('id'))
                    ->where('number', (int) $match[2])
                    ->first();

                if ($task !== null) {
                    $taskIds[$task->id] = $part;
                    $inline[] = ['type' => 'taskReference', 'attrs' => ['id' => $task->id, 'label' => $part]];

                    continue;
                }
            }

            $inline[] = ['type' => 'text', 'text' => $part];
        }

        return RichText::sanitize(['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => $inline]]], $peopleIds, $taskIds);
    }

    /**
     * @param  array<string, User>  $people
     * @param  list<string>  $personas
     * @return list<User>
     */
    private function pick(array $people, array $personas): array
    {
        return array_values(array_filter(array_map(fn (string $persona): ?User => $people[$persona] ?? null, $personas)));
    }
}
