<?php

namespace App\Http\Resources\Meetings;

use App\Domain\Meetings\Actions\ChooseMinutesSource;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MinutesSource;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Meetings\Queries\PreviousMinutes;
use App\Domain\Meetings\Queries\SpeakingTimes;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Services\MeetingParticipants;
use App\Domain\Meetings\Services\MinutesCollab;
use App\Domain\Meetings\Services\MinutesEditing;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\NotulenBridge;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;

/**
 * `room` prop of the pre-join (meetings/join) and room (meetings/room) pages
 * of the "Notulen Hidup" video room — docs/fitur/rapat-video-kontrak.md §1,
 * resources/js/types/meetings-room.ts RoomProps. Callers eager-load
 * meeting.participants and meeting.workspace. Fixed number of queries
 * (PageQueryCountTest): people, minutes (+ follow-ups, tasks), previous
 * minutes (+ follow-ups, tasks), attendance roster, speaking times.
 */
final class RoomPresenter
{
    /** Same palette and hash as avatarTone() in resources/js/components/ui/avatar.tsx. */
    private const array TONES = ['blue', 'teal', 'amber'];

    public function __construct(
        private readonly MeetingFeed $feed,
        private readonly MeetingPresenter $meetings,
        private readonly VideoPresenter $video,
        private readonly VideoAttendance $attendance,
        private readonly SpeakingTimes $speaking,
        private readonly PreviousMinutes $previous,
        private readonly MinutesStore $store,
        private readonly MeetingParticipants $participants,
        private readonly MeetingPolicy $policy,
        private readonly VideoRooms $rooms,
        private readonly MinutesCollab $collab,
        private readonly MinutesEditing $editing,
    ) {}

    /**
     * @param  array<string, mixed>|null  $notulen  NotulenBridge summary
     * @return array<string, mixed>
     */
    public function room(Occurrence $occurrence, User $viewer, ?array $notulen = null, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $meeting = $occurrence->meeting;

        $minutes = $this->store->find($occurrence)?->load('actionItems.task.workspace:id,key');
        $previous = $this->previous->for($occurrence);
        $roster = $this->attendance->roster($occurrence, $now);
        $doc = $this->meetings->minutes($occurrence, $minutes);
        $people = $this->feed->people([$occurrence], array_filter([$minutes, $previous]), [$viewer->id]);

        // Collaborative (FEATURE_NOTES + collab server): every invited person
        // edits the text; otherwise the minute taker / organizer, last write wins.
        $collab = MinutesCollab::enabled();
        $canWrite = $this->policy->editMinutes($viewer, $meeting, $minutes)->allowed();
        $canEdit = $collab ? $this->collab->canEdit($viewer, $meeting, $minutes, $occurrence->date) : $canWrite;
        $can = [
            'edit_minutes' => $canEdit,
            'choose_notes_source' => $canWrite && $minutes?->notes_source === null,
            'moderate' => $this->policy->moderateVideo($viewer, $meeting)->allowed(),
            // External guests: guest list with links = organizer; waiting room = everyone invited.
            'manage_guests' => $this->policy->manageGuests($viewer, $meeting)->allowed(),
            'manage_lobby' => $this->policy->manageLobby($viewer, $meeting)->allowed(),
            'call_participants' => $this->policy->callParticipant($viewer, $meeting)->allowed(),
            'report_speaking' => $this->policy->joinVideo($viewer, $meeting, $occurrence, $now)->allowed(),
        ];

        return [
            'viewer' => ['id' => $viewer->id, 'name' => $viewer->name, 'avatar_url' => $viewer->getAttribute('avatar_url')],
            'meeting' => [
                'id' => $meeting->id,
                'title' => $meeting->title,
                'occurrence_date' => $occurrence->date,
                'starts_at' => $occurrence->startsAt->toIso8601ZuluString(),
                'ends_at' => $occurrence->endsAt->toIso8601ZuluString(),
                'href' => $occurrence->url(),
                'minutes_href' => $occurrence->url('/notulen'),
                'organizer_id' => $meeting->organizer_id,
                'minute_taker_id' => $meeting->minute_taker_id,
                'agenda' => $meeting->agenda,
                'is_recurring' => $meeting->isRecurring(),
                'workspace' => $meeting->workspace !== null
                    ? ['id' => $meeting->workspace->id, 'key' => $meeting->workspace->key, 'name' => $meeting->workspace->name]
                    : null,
            ],
            'people' => $people,
            'participants' => $this->participants($occurrence, $people),
            'agenda' => self::agenda($meeting->agenda, $doc),
            'minutes' => [
                'mode' => $collab ? 'collab' : 'autosave',
                'collab' => $collab ? [
                    'token_url' => $occurrence->url('/notulen/kolaborasi'),
                    'url' => (string) config('collab.public_url'),
                ] : null,
                'doc' => $doc,
                'can_edit' => $canEdit,
                'can_edit_attendance' => $canWrite,
                'can_finalize' => $canWrite,
                'editing' => $collab ? null : $this->editing->current($occurrence, $now),
                'links' => [
                    'page' => $occurrence->url('/notulen'),
                    'data' => $occurrence->url('/notulen/data'),
                    'save' => $occurrence->url('/notulen'),
                    'finalize' => $occurrence->url('/notulen/final'),
                    'items' => $occurrence->url('/tindak-lanjut'),
                    'tasks' => $occurrence->url('/notulen/tugas'),
                    'editing' => $occurrence->url('/notulen/menyunting'),
                ],
            ],
            'notes_source' => $this->notesSource($occurrence, $minutes, $previous, $can['choose_notes_source']),
            'speaking' => $this->speaking->forViewer($occurrence, $viewer->id, array_column($roster['attendance'], 'user_id')),
            'video' => $this->video->summary($occurrence, $viewer, $now, $roster),
            'features' => [
                'video_configured' => $this->rooms->configured(),
                'realtime' => RoomEvents::realtime(),
                'subtitles' => (bool) config('livekit.subtitles', false),
                'auto_minutes' => NotulenBridge::autoMinutes($notulen),
                'collab_minutes' => $collab,
            ],
            'can' => $can,
            'channel' => 'meeting.'.$meeting->id,
            'links' => [
                'token' => $occurrence->url('/video/token'),
                'notes_source' => $occurrence->url('/video/sumber-notulen'),
                'speaking' => $occurrence->url('/video/bicara'),
                'attendance' => $occurrence->url('/video/kehadiran'),
                'call' => $occurrence->url('/video/panggil/{user}'),
                'readmit' => $occurrence->url('/video/peserta/{user}/larangan'),
                'hand' => $occurrence->url('/video/tangan'),
                'attributes' => $occurrence->url('/video/atribut'),
                'join' => $occurrence->url('/gabung'),
                'room' => $occurrence->url('/ruang'),
            ],
        ];
    }

    /**
     * Pre-join notes source (§2.1).
     *
     * @return array<string, mixed>
     */
    public function notesSource(Occurrence $occurrence, ?MeetingMinutes $minutes, ?MeetingMinutes $previous, bool $canChoose): array
    {
        $open = $this->previous->openItems($previous);
        $template = ChooseMinutesSource::templated($occurrence->meeting->agenda, []);

        return [
            'chosen' => $minutes?->notes_source?->value,
            'chosen_by' => $minutes?->notes_source_by,
            'chosen_at' => $minutes?->notes_source_at?->toIso8601ZuluString(),
            'can_choose' => $canChoose,
            'suggested' => ($open !== [] ? MinutesSource::Continue : MinutesSource::Template)->value,
            'previous' => $previous !== null ? [
                'occurrence_date' => $previous->occurrence_date->toDateString(),
                'href' => (new Occurrence($occurrence->meeting, $previous->occurrence_date->toDateString(), $occurrence->startsAt, $occurrence->endsAt))->url('/notulen'),
                'status' => $previous->status->value,
                'open_count' => count($open),
            ] : null,
            'open_follow_ups' => array_map(fn (MeetingActionItem $item): array => [
                ...MeetingPresenter::actionItem($item),
                'overdue' => $item->due_date !== null && $item->due_date->toDateString() < $occurrence->date,
            ], $open),
            'template' => [
                'key' => 'agenda',
                'label' => ChooseMinutesSource::templateLabel($occurrence->meeting),
                'sections' => array_column($template, 'title'),
                'blocks' => ['Keputusan', 'Tindak lanjut'],
            ],
        ];
    }

    /**
     * Invited employees with avatar tone, collaborator seat and room roles.
     *
     * @param  list<array<string, mixed>>  $people
     * @return list<array<string, mixed>>
     */
    private function participants(Occurrence $occurrence, array $people): array
    {
        $meeting = $occurrence->meeting;
        $byId = [];

        foreach ($people as $person) {
            $byId[(string) $person['id']] = $person;
        }

        $invited = array_values(array_filter(
            $this->participants->invited($meeting),
            fn (array $entry): bool => isset($byId[$entry['user_id']]),
        ));

        usort($invited, function (array $a, array $b) use ($meeting, $byId): int {
            $rank = fn (string $id): int => $id === $meeting->organizer_id ? 0 : ($id === $meeting->minute_taker_id ? 1 : 2);

            return [$rank($a['user_id']), mb_strtolower((string) $byId[$a['user_id']]['name']), $a['user_id']]
                <=> [$rank($b['user_id']), mb_strtolower((string) $byId[$b['user_id']]['name']), $b['user_id']];
        });

        $result = [];

        foreach ($invited as $seat => $entry) {
            $person = $byId[$entry['user_id']];
            $name = (string) $person['name'];
            $roles = array_values(array_filter([
                $entry['user_id'] === $meeting->organizer_id ? 'organizer' : null,
                $entry['user_id'] === $meeting->minute_taker_id ? 'minute_taker' : null,
            ]));

            $result[] = [
                'id' => $entry['user_id'],
                'name' => $name,
                'first_name' => self::firstName($name),
                'initials' => self::initials($name),
                'title' => $person['title'],
                'division' => $person['division'],
                'avatar_url' => $person['avatar_url'],
                'tone' => self::tone($name),
                'seat' => $seat,
                'roles' => $roles,
                'role_label' => self::roleLabel($roles),
                'rsvp' => $entry['rsvp'],
                'optional' => $entry['optional'],
            ];
        }

        return $result;
    }

    /**
     * Navigator: the minutes' sections (agenda items or extra), then the
     * fixed Keputusan and Tindak lanjut blocks.
     *
     * @param  list<string>  $agenda
     * @param  array<string, mixed>  $doc  MeetingPresenter::minutes()
     * @return list<array{key: string, index: int|null, title: string, kind: string, has_notes: bool}>
     */
    public static function agenda(array $agenda, array $doc): array
    {
        /** @var list<array{title: string, body: string}> $sections */
        $sections = $doc['sections'];
        $result = [];

        foreach ($sections as $index => $section) {
            $result[] = [
                'key' => 'section-'.$index,
                'index' => $index,
                'title' => $section['title'],
                'kind' => in_array($section['title'], $agenda, true) ? 'agenda' : 'extra',
                'has_notes' => trim($section['body']) !== '',
            ];
        }

        $result[] = ['key' => 'decisions', 'index' => null, 'title' => 'Keputusan', 'kind' => 'decisions', 'has_notes' => $doc['decisions'] !== []];
        $result[] = ['key' => 'action-items', 'index' => null, 'title' => 'Tindak lanjut', 'kind' => 'action_items', 'has_notes' => $doc['action_items'] !== []];

        return $result;
    }

    /**
     * avatarTone(name) of components/ui/avatar.tsx: hash = hash * 31 + UTF-16
     * code unit of each code point's first unit, as uint32.
     */
    public static function tone(string $name): string
    {
        $hash = 0;

        foreach (mb_str_split($name) as $char) {
            $point = mb_ord($char);
            $unit = $point > 0xFFFF ? 0xD800 + (($point - 0x10000) >> 10) : $point;
            $hash = ($hash * 31 + $unit) & 0xFFFFFFFF;
        }

        return self::TONES[$hash % count(self::TONES)];
    }

    public static function initials(string $name): string
    {
        $words = array_values(array_filter(preg_split('/\s+/u', trim($name)) ?: [], fn (string $word): bool => $word !== ''));
        $letters = array_map(fn (string $word): string => mb_strtoupper(mb_substr($word, 0, 1)), array_slice($words, 0, 2));

        return implode('', $letters);
    }

    public static function firstName(string $name): string
    {
        $words = preg_split('/\s+/u', trim($name)) ?: [];

        return $words[0] ?? $name;
    }

    /**
     * @param  list<string>  $roles
     */
    private static function roleLabel(array $roles): ?string
    {
        $labels = array_map(fn (string $role): string => $role === 'organizer' ? 'Penyelenggara' : 'Notulis', $roles);

        return $labels === [] ? null : implode(' · ', $labels);
    }
}
