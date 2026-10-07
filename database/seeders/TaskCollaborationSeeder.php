<?php

namespace Database\Seeders;

use App\Domain\Tasks\Services\RichText;
use App\Models\Activity;
use App\Models\Comment;
use App\Models\Mention;
use App\Models\Reaction;
use App\Models\SavedView;
use App\Models\Task;
use App\Models\TaskCommentRead;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Sprint 6 demo: rich description, comments with mentions & reactions on
 * PLQ-21 (mockup TaskDetail) and saved views of PLQ. Writes rows directly —
 * no notifications or broadcasts. Idempotent (skips when comments exist).
 */
class TaskCollaborationSeeder extends Seeder
{
    public function run(): void
    {
        $workspace = Workspace::query()->where('key', 'PLQ')->first();
        $task = $workspace !== null ? Task::query()->where('workspace_id', $workspace->id)->where('number', 21)->first() : null;

        if ($workspace === null || $task === null || $task->comments()->withTrashed()->exists()) {
            return;
        }

        /** @var array<string, User> $people */
        $people = User::query()->whereIn('email', ['kadiv@demo.test', 'anggota@demo.test', 'maya.lestari@demo.test', 'sari.wulandari@demo.test'])
            ->get()->keyBy('email')->all();
        $kadiv = $people['kadiv@demo.test'] ?? null;
        $rizky = $people['anggota@demo.test'] ?? null;
        $maya = $people['maya.lestari@demo.test'] ?? null;
        $sari = $people['sari.wulandari@demo.test'] ?? null;

        if ($kadiv === null || $rizky === null || $maya === null || $sari === null) {
            return;
        }

        $reference = Task::query()->where('workspace_id', $workspace->id)->where('number', 27)->first();
        $crm = Task::query()->where('workspace_id', $workspace->id)->where('number', 33)->first() ?? $reference;
        $text = fn (string $value): array => ['type' => 'text', 'text' => $value];
        $mention = fn (User $user): array => ['type' => 'mention', 'attrs' => ['id' => $user->id, 'label' => $user->name]];
        $ref = fn (?Task $target): array => $target === null
            ? $text('#PLQ')
            : ['type' => 'taskReference', 'attrs' => ['id' => $target->id, 'label' => 'PLQ-'.$target->number]];

        $description = ['type' => 'doc', 'content' => [
            ['type' => 'paragraph', 'content' => [
                $text('Halaman arahan untuk produk yang diluncurkan pada 27 Oktober. Fokus utama: pendaftaran demo dan kejelasan paket harga. Teks mengikuti brief dari tim Pemasaran, koordinasikan perubahan salinan dengan '),
                $mention($maya),
                $text('.'),
            ]],
            ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [$text('Ruang lingkup')]],
            ['type' => 'bulletList', 'content' => array_map(fn (array $inline): array => [
                'type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => $inline]],
            ], [
                [$text('Hero section dengan tombol utama "Jadwalkan demo"')],
                [$text('Bagian fitur utama (6 kartu), aset visual mengikuti '), $ref($reference)],
                [$text('Tabel harga tiga paket dan bagian pertanyaan umum')],
                [$text('Formulir demo terhubung ke CRM, sesuai '), ['type' => 'text', 'text' => 'panduan merek 2026', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'https://drive.google.com/']]]]],
            ])],
        ]];

        // History before the discussion: the seeded activities happened when the task was created.
        $start = $task->created_at !== null && $task->created_at->lt(now()->subDays(3)) ? $task->created_at : now()->subDays(3);

        foreach (Activity::query()->where('subject_id', $task->id)->orderBy('id')->pluck('id') as $index => $activityId) {
            Activity::query()->whereKey($activityId)->update(['created_at' => $start->addMinutes($index)]);
        }

        $task->forceFill([
            'description' => $description,
            'description_text' => 'Halaman arahan untuk produk yang diluncurkan pada 27 Oktober. Fokus utama: pendaftaran demo dan kejelasan paket harga.',
        ])->saveQuietly();
        $this->mention($task, $maya, $kadiv);

        $first = $this->comment($task, $maya, [
            $text('Brief sudah final. '), $mention($rizky),
            $text(' tolong pakai teks hero versi B di dokumen brief, hasil uji ke 5 rekan lebih mudah dipahami.'),
        ], now()->subDays(2));
        $this->mention($first, $rizky, $maya);

        foreach ([$kadiv, $rizky, $sari] as $user) {
            Reaction::query()->insertOrIgnore([
                'id' => strtolower((string) str()->ulid()),
                'reactable_type' => $first->getMorphClass(),
                'reactable_id' => $first->id,
                'user_id' => $user->id,
                'emoji' => '👍',
                'created_at' => now()->subDays(2),
            ]);
        }

        $second = $this->comment($task, $rizky, [
            $text('Hero dan navigasi sudah naik di staging. '), $mention($maya),
            $text(' mohon cek teks versi ponsel, ada dua baris yang terpotong. Formulir demo masih menunggu akses API CRM di '), $ref($crm), $text('.'),
        ], now()->subDay(), edited: true);
        $this->mention($second, $maya, $rizky);

        // "Dibaca oleh": Maya and Sari have read the latest comment, Rizky the
        // first one; Dimas has not opened the discussion yet (unread dot on the card).
        foreach ([[$rizky, $first, 20], [$maya, $second, 3], [$sari, $second, 2]] as [$reader, $upTo, $hoursAgo]) {
            TaskCommentRead::query()->insertOrIgnore([
                'task_id' => $task->id,
                'user_id' => $reader->id,
                'last_read_comment_id' => $upTo->id,
                'last_read_at' => $upTo->created_at,
                'created_at' => now()->subHours($hoursAgo),
                'updated_at' => now()->subHours($hoursAgo),
            ]);
        }

        foreach ([$kadiv, $rizky, $maya, $sari] as $watcher) {
            $task->watchers()->newPivotStatement()->insertOrIgnore([
                'task_id' => $task->id, 'user_id' => $watcher->id, 'created_at' => now(),
            ]);
        }

        SavedView::query()->create([
            'user_id' => $kadiv->id, 'workspace_id' => $workspace->id, 'name' => 'Tugas saya',
            'layout' => 'list', 'filters' => ['assignees' => ['me'], 'priorities' => [], 'labels' => [], 'due' => null, 'q' => ''], 'is_shared' => true,
        ]);
        SavedView::query()->create([
            'user_id' => $kadiv->id, 'workspace_id' => $workspace->id, 'name' => 'Tenggat minggu ini',
            'layout' => 'board', 'filters' => ['assignees' => [], 'priorities' => [], 'labels' => [], 'due' => 'week', 'q' => ''], 'is_shared' => false,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $inline
     */
    private function comment(Task $task, User $author, array $inline, CarbonImmutable $at, bool $edited = false): Comment
    {
        $body = ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => $inline]]];

        $comment = new Comment([
            'commentable_type' => $task->getMorphClass(),
            'commentable_id' => $task->id,
            'user_id' => $author->id,
            'body' => $body,
            'body_text' => RichText::toText($body) ?? '',
            'edited_at' => $edited ? $at : null,
        ]);
        $comment->created_at = $at;
        $comment->updated_at = $at;
        $comment->saveQuietly();

        return $comment;
    }

    private function mention(Comment|Task $mentionable, User $user, User $by): void
    {
        Mention::query()->insertOrIgnore([
            'id' => strtolower((string) str()->ulid()),
            'mentionable_type' => $mentionable->getMorphClass(),
            'mentionable_id' => $mentionable->getKey(),
            'mentioned_user_id' => $user->id,
            'created_by' => $by->id,
            'created_at' => now(),
        ]);
    }
}
