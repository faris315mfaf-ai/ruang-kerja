<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Services\HiringAccess;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateNote;
use App\Models\HiringPosition;
use App\Models\HiringSetting;
use App\Models\InterviewScore;
use App\Models\User;

require_once __DIR__.'/../../Support/hiring-helpers.php';

/*
 * Hiring access matrix. 'allow' · 'deny' (403) · 'hidden' (404).
 * HR & Super Admin: everything. Interviewers & final approvers of the
 * position: their part. Other Kepala Divisi / Direksi / members, another
 * company and deactivated reviewers: 404.
 */
beforeEach(function () {
    $this->world = hiringWorld();
});

function hiringActor(string $who): User
{
    return test()->world->{$who};
}

it('applies the position matrix', function (string $who, string $viewAny, string $view, string $update) {
    $user = hiringActor($who);
    $position = test()->world->position;

    expect([
        hiringVerdict($user, 'viewAny', HiringPosition::class),
        hiringVerdict($user, 'view', $position),
        hiringVerdict($user, 'update', $position),
    ])->toBe([$viewAny, $view, $update]);
})->with([
    //                    viewAny  view     update
    'hr' => ['hr', 'allow', 'allow', 'allow'],
    'super admin' => ['admin', 'allow', 'allow', 'allow'],
    'interviewer' => ['interviewer', 'allow', 'allow', 'deny'],
    'approver' => ['approver', 'allow', 'allow', 'deny'],
    'other kadiv' => ['kadiv', 'hidden', 'hidden', 'hidden'],
    'other direksi' => ['direksi', 'hidden', 'hidden', 'hidden'],
    'anggota' => ['anggota', 'hidden', 'hidden', 'hidden'],
    'other company hr' => ['foreign', 'allow', 'hidden', 'hidden'],
    'deactivated interviewer' => ['inactive', 'hidden', 'hidden', 'hidden'],
]);

it('applies the candidate matrix', function (string $who, string $view, string $manage, string $score, string $note, string $decide) {
    $candidate = test()->world->candidate;
    $candidate->forceFill(['stage' => CandidateStage::FinalReview])->save();
    $user = hiringActor($who);

    expect([
        hiringVerdict($user, 'view', $candidate),
        hiringVerdict($user, 'manage', $candidate),
        hiringVerdict($user, 'score', $candidate),
        hiringVerdict($user, 'note', $candidate),
        hiringVerdict($user, 'decide', $candidate),
    ])->toBe([$view, $manage, $score, $note, $decide]);
})->with([
    //                          view     manage   score    note     decide
    'hr' => ['hr', 'allow', 'allow', 'deny', 'allow', 'deny'],
    'super admin' => ['admin', 'allow', 'allow', 'deny', 'allow', 'deny'],
    'interviewer' => ['interviewer', 'allow', 'deny', 'allow', 'allow', 'deny'],
    'approver' => ['approver', 'allow', 'deny', 'deny', 'allow', 'allow'],
    'other kadiv' => ['kadiv', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'other direksi' => ['direksi', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'anggota' => ['anggota', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'other company hr' => ['foreign', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'deactivated interviewer' => ['inactive', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('lets approvers decide only during Keputusan akhir and nobody score a decided candidate', function () {
    $world = $this->world;

    expect(hiringVerdict($world->approver, 'decide', $world->candidate))->toBe('deny');

    $world->candidate->forceFill(['stage' => CandidateStage::Hired])->save();

    expect(hiringVerdict($world->interviewer, 'score', $world->candidate))->toBe('deny')
        ->and(hiringVerdict($world->approver, 'decide', $world->candidate))->toBe('deny');
});

it('applies the settings matrix', function (string $who, string $verdict) {
    expect(hiringVerdict(hiringActor($who), 'update', HiringSetting::class))->toBe($verdict);
})->with([
    'hr' => ['hr', 'allow'],
    'super admin' => ['admin', 'allow'],
    'interviewer' => ['interviewer', 'deny'],
    'approver' => ['approver', 'deny'],
    'other kadiv' => ['kadiv', 'hidden'],
    'anggota' => ['anggota', 'hidden'],
]);

it('lets every reviewer tick only their own checklist items', function () {
    $world = $this->world;
    $items = CandidateChecklistItem::query()->where('candidate_id', $world->candidate->id)->get();
    $hrItem = $items->firstWhere('reviewer_id', null);
    $interviewerItem = $items->firstWhere('reviewer_id', $world->interviewer->id);
    $approverItem = $items->firstWhere('reviewer_id', $world->approver->id);

    expect([
        hiringVerdict($world->hr, 'check', $hrItem),
        hiringVerdict($world->hr, 'check', $interviewerItem),
        hiringVerdict($world->interviewer, 'check', $interviewerItem),
        hiringVerdict($world->interviewer2, 'check', $interviewerItem),
        hiringVerdict($world->interviewer, 'check', $hrItem),
        hiringVerdict($world->approver, 'check', $approverItem),
        hiringVerdict($world->approver, 'check', $interviewerItem),
        hiringVerdict($world->kadiv, 'check', $hrItem),
        hiringVerdict($world->hr, 'delete', $interviewerItem),
        hiringVerdict($world->interviewer, 'delete', $interviewerItem),
    ])->toBe(['allow', 'deny', 'allow', 'deny', 'deny', 'allow', 'deny', 'hidden', 'allow', 'deny']);

    $interviewerItem->forceFill(['checked_at' => now()])->save();

    expect(hiringVerdict($world->hr, 'delete', $interviewerItem))->toBe('deny');
});

it('keeps interview points private to their interviewer except for HR and approvers', function () {
    $world = $this->world;
    $score = InterviewScore::query()->create([
        'candidate_id' => $world->candidate->id,
        'question_id' => $world->questions[0]->id,
        'interviewer_id' => $world->interviewer->id,
        'score' => 4,
    ]);

    expect([
        hiringVerdict($world->interviewer, 'view', $score),
        hiringVerdict($world->interviewer2, 'view', $score),
        hiringVerdict($world->hr, 'view', $score),
        hiringVerdict($world->approver, 'view', $score),
        hiringVerdict($world->interviewer, 'update', $score),
        hiringVerdict($world->interviewer2, 'update', $score),
        hiringVerdict($world->hr, 'update', $score),
        hiringVerdict($world->kadiv, 'view', $score),
    ])->toBe(['allow', 'hidden', 'allow', 'allow', 'allow', 'deny', 'deny', 'hidden']);
});

it('lets only the author edit interview minutes', function () {
    $world = $this->world;
    $note = CandidateNote::query()->create([
        'candidate_id' => $world->candidate->id,
        'author_id' => $world->interviewer->id,
        'body' => 'Catatan wawancara.',
    ]);

    expect([
        hiringVerdict($world->interviewer, 'update', $note),
        hiringVerdict($world->hr, 'update', $note),
        hiringVerdict($world->approver, 'view', $note),
        hiringVerdict($world->approver, 'delete', $note),
        hiringVerdict($world->anggota, 'view', $note),
    ])->toBe(['allow', 'deny', 'allow', 'deny', 'hidden']);
});

it('scopes lists to what the viewer may see', function () {
    $world = $this->world;
    $other = HiringPosition::factory()->create(['title' => 'Staf Konten']);
    Candidate::factory()->forPosition($other)->create();

    expect(HiringPosition::query()->visibleTo($world->hr)->count())->toBe(2)
        ->and(HiringPosition::query()->visibleTo($world->interviewer)->pluck('id')->all())->toBe([$world->position->id])
        ->and(Candidate::query()->visibleTo($world->approver)->pluck('id')->all())->toBe([$world->candidate->id])
        ->and(Candidate::query()->visibleTo($world->hr)->count())->toBe(2)
        ->and(Candidate::query()->visibleTo($world->kadiv)->count())->toBe(0)
        ->and(Candidate::query()->visibleTo($world->foreign)->count())->toBe(0);

    $access = app(HiringAccess::class);

    expect($access->canEnter($world->hr))->toBeTrue()
        ->and($access->canEnter($world->interviewer2))->toBeTrue()
        ->and($access->canEnter($world->approver))->toBeTrue()
        ->and($access->canEnter($world->kadiv))->toBeFalse()
        ->and($access->canEnter($world->inactive))->toBeFalse();
});
