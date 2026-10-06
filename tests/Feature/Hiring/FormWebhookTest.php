<?php

use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Notifications\CandidateReceivedNotification;
use App\Domain\Hiring\Services\WebhookSignature;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\HiringPosition;
use App\Models\InboxNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
 * POST /api/hiring/form/{token}: Google Form → Apps Script → RuangKerja.
 */
beforeEach(function () {
    $this->world = hiringWorld();
    $this->position = $this->world->position;
});

/**
 * @param  array<string, mixed>  $payload
 */
function hiringPost(HiringPosition $position, array|string $payload, ?string $signature = null, ?string $token = null): TestResponse
{
    $body = is_string($payload) ? $payload : (string) json_encode($payload);
    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

    if ($signature !== '') {
        $server['HTTP_X_RUANGKERJA_SIGNATURE'] = $signature ?? WebhookSignature::sign($body, $position->webhook_secret);
    }

    return test()->call('POST', '/api/hiring/form/'.($token ?? $position->webhook_token), [], [], [], $server, $body);
}

/**
 * @return array<string, mixed>
 */
function hiringFormPayload(string $responseId = 'resp-001'): array
{
    return [
        'response_id' => $responseId,
        'submitted_at' => '2026-10-05T02:30:00Z',
        'answers' => [
            ['question' => 'Nama lengkap', 'answer' => 'Galih Pratama'],
            ['question' => 'Email', 'answer' => 'Galih.Pratama@contoh.id'],
            ['question' => 'No. HP', 'answer' => '081234567890'],
            ['question' => 'Bahasa yang dikuasai', 'answer' => ['PHP', 'Go']],
        ],
        'files' => [
            ['label' => 'CV', 'url' => 'https://drive.google.com/open?id=abc123'],
        ],
    ];
}

it('creates a candidate from a signed Form response', function () {
    Notification::fake();

    hiringPost($this->position, hiringFormPayload())
        ->assertCreated()
        ->assertJsonPath('status', 'created');

    $candidate = Candidate::query()->where('external_response_id', 'resp-001')->sole();

    expect($candidate->full_name)->toBe('Galih Pratama')
        ->and($candidate->email)->toBe('galih.pratama@contoh.id')
        ->and($candidate->phone)->toBe('081234567890')
        ->and($candidate->cv_url)->toBe('https://drive.google.com/open?id=abc123')
        ->and($candidate->stage)->toBe(CandidateStage::Applied)
        ->and($candidate->source)->toBe(CandidateSource::GoogleForm)
        ->and($candidate->external_response_id)->toBe('resp-001')
        ->and($candidate->applied_at->toIso8601String())->toBe('2026-10-05T02:30:00+00:00')
        ->and($candidate->form_answers[3])->toEqual(['question' => 'Bahasa yang dikuasai', 'answer' => 'PHP, Go'])
        ->and($candidate->attachments)->toEqual([['label' => 'CV', 'url' => 'https://drive.google.com/open?id=abc123']]);

    // Checklist: HR items + one set per active interviewer & approver.
    expect(CandidateChecklistItem::query()->where('candidate_id', $candidate->id)->whereNull('reviewer_id')->count())->toBe(3)
        ->and(CandidateChecklistItem::query()->where('candidate_id', $candidate->id)->where('reviewer_id', $this->world->approver->id)->count())->toBe(1);

    Notification::assertSentTo($this->world->hr, CandidateReceivedNotification::class);
    Notification::assertNotSentTo([$this->world->interviewer, $this->world->approver, $this->world->foreign], CandidateReceivedNotification::class);
});

it('is idempotent per response id', function () {
    hiringPost($this->position, hiringFormPayload())->assertCreated();
    $first = Candidate::query()->where('external_response_id', 'resp-001')->sole();

    hiringPost($this->position, hiringFormPayload())
        ->assertOk()
        ->assertJsonPath('status', 'duplicate')
        ->assertJsonPath('candidate_id', $first->id);

    expect(Candidate::query()->count())->toBe(2)
        ->and(InboxNotification::query()->where('type', NotificationType::HiringCandidateReceived->value)->count())->toBe(1);

    // Even after HR deleted the candidate, a retry does not bring it back.
    $first->delete();
    hiringPost($this->position, hiringFormPayload())->assertOk()->assertJsonPath('status', 'duplicate');
    expect(Candidate::query()->where('external_response_id', 'resp-001')->count())->toBe(0);
});

it('rejects a wrong, missing or foreign signature with 401', function (string $case) {
    $other = HiringPosition::factory()->create();
    $body = (string) json_encode(hiringFormPayload());

    $signature = match ($case) {
        'wrong' => WebhookSignature::sign($body, 'not-the-secret'),
        'missing' => '',
        'other position' => WebhookSignature::sign($body, $other->webhook_secret),
        'tampered body' => WebhookSignature::sign($body.' ', $this->position->webhook_secret),
        'garbage' => 'abc',
    };

    hiringPost($this->position, $body, $signature)->assertUnauthorized();

    expect(Candidate::query()->whereNotNull('external_response_id')->count())->toBe(0);
})->with(['wrong', 'missing', 'other position', 'tampered body', 'garbage']);

it('accepts the sha256= prefix of the signature', function () {
    $body = (string) json_encode(hiringFormPayload());

    hiringPost($this->position, $body, 'sha256='.WebhookSignature::sign($body, $this->position->webhook_secret))->assertCreated();
});

it('answers 410 for a closed position and 404 for an unknown token', function () {
    $this->position->forceFill(['status' => PositionStatus::Closed])->save();

    hiringPost($this->position, hiringFormPayload())->assertStatus(410);
    hiringPost($this->position, hiringFormPayload(), null, str_repeat('a', 40))->assertNotFound();

    $this->position->delete();
    hiringPost($this->position, hiringFormPayload())->assertNotFound();

    expect(Candidate::withTrashed()->count())->toBe(1); // only the fixture candidate
});

it('accepts responses while the position is a draft (testing the form)', function () {
    $this->position->forceFill(['status' => PositionStatus::Draft])->save();

    hiringPost($this->position, hiringFormPayload())->assertCreated();
});

it('validates the body', function () {
    hiringPost($this->position, 'not json')->assertUnprocessable();
    hiringPost($this->position, ['answers' => []])->assertUnprocessable()->assertJsonValidationErrors('response_id');
});

it('maps fields with the position field map before the built-in guesses', function () {
    $this->position->forceFill(['field_map' => [
        'full_name' => 'Siapa nama Anda?',
        'email' => 'Alamat surel aktif',
        'phone' => 'Nomor WhatsApp',
        'cv_url' => 'Unggah CV terbaru',
    ]])->save();

    hiringPost($this->position, [
        'response_id' => 'resp-map',
        'answers' => [
            ['question' => 'Nama lengkap', 'answer' => 'Bukan ini'],
            ['question' => 'Siapa nama Anda? *', 'answer' => 'Intan Permata'],
            ['question' => 'Alamat surel aktif', 'answer' => 'intan@contoh.id'],
            ['question' => 'nomor  whatsapp', 'answer' => '0899'],
        ],
        'files' => [
            ['label' => 'Portofolio', 'url' => 'https://drive.google.com/open?id=porto'],
            ['label' => 'Unggah CV terbaru', 'url' => 'https://drive.google.com/open?id=cv'],
        ],
    ])->assertCreated();

    $candidate = Candidate::query()->where('external_response_id', 'resp-map')->sole();

    expect([$candidate->full_name, $candidate->email, $candidate->phone, $candidate->cv_url])
        ->toBe(['Intan Permata', 'intan@contoh.id', '0899', 'https://drive.google.com/open?id=cv']);
});

it('keeps unsafe links out and survives a response without a name', function () {
    hiringPost($this->position, [
        'response_id' => 'resp-unsafe',
        'answers' => [
            ['question' => 'Email', 'answer' => 'bukan-email'],
            ['question' => 'CV', 'answer' => 'javascript:alert(1)'],
        ],
        'files' => [
            ['label' => 'CV', 'url' => 'javascript:alert(1)'],
            ['label' => 'Lain', 'url' => 'ftp://contoh.id/cv.pdf'],
        ],
    ])->assertCreated();

    $candidate = Candidate::query()->where('external_response_id', 'resp-unsafe')->sole();

    expect($candidate->full_name)->toBe('Pelamar tanpa nama')
        ->and($candidate->email)->toBeNull()
        ->and($candidate->cv_url)->toBeNull()
        ->and($candidate->attachments)->toBe([]);
});

it('audits the arrival without applicant data and sets no cookies', function () {
    $response = hiringPost($this->position, hiringFormPayload());

    $response->assertCreated();
    expect($response->headers->getCookies())->toBe([]);

    $audit = AuditLog::query()->where('action', 'hiring.candidate_received')->sole();

    expect($audit->new_values)->toEqual([
        'position_id' => $this->position->id,
        'source' => 'google_form',
        'stage' => 'applied',
    ])->and(json_encode($audit->new_values))->not->toContain('Galih');
});

it('notifies HR in-app with the position in the text', function () {
    hiringPost($this->position, hiringFormPayload())->assertCreated();

    $notification = InboxNotification::query()->where('notifiable_id', $this->world->hr->id)->sole();

    expect($notification->type)->toBe('hiring.candidate_received')
        ->and($notification->data['title'])->toBe('Galih Pratama melamar Staf Programmer')
        ->and($notification->data['url'])->toStartWith('/hiring/kandidat/');
});

it('accepts the ASCII-escaped JSON the Apps Script sends', function () {
    // Exactly what the script in docs/fitur/hiring.md produces for "Nádia".
    $body = '{"response_id":"resp-esc","answers":[{"question":"Nama lengkap","answer":"Nádia Putri"}],"files":[]}';

    hiringPost($this->position, $body)->assertCreated();

    expect(Candidate::query()->where('external_response_id', 'resp-esc')->sole()->full_name)->toBe('Nádia Putri');
});
