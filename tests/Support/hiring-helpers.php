<?php

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Organization\Enums\Role;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\Company;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/*
 * Shared Hiring test fixture (require_once in each Hiring test file).
 */

if (! function_exists('hiringWorld')) {
    /**
     * HR, Super Admin, two interviewers, two final approvers, an unrelated
     * Kepala Divisi, Direksi and member, a foreign-company HR and an inactive
     * former interviewer; one open position with three questions and one
     * candidate in "Masuk" with its seeded checklist.
     *
     * @return object{hr: User, admin: User, interviewer: User, interviewer2: User, approver: User, approver2: User, kadiv: User, direksi: User, anggota: User, foreign: User, inactive: User, position: HiringPosition, questions: list<HiringQuestion>, candidate: Candidate}
     */
    function hiringWorld(): object
    {
        $hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana HR']);
        $interviewer = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pewawancara']);
        $interviewer2 = User::factory()->withRole(Role::Anggota)->create(['name' => 'Arif Pewawancara']);
        $approver = User::factory()->withRole(Role::Direksi)->create(['name' => 'Faris']);
        $approver2 = User::factory()->withRole(Role::Direksi)->create(['name' => 'Dio']);
        $inactive = User::factory()->withRole(Role::Anggota)->create(['status' => 'inactive']);

        $position = HiringPosition::factory()
            ->interviewers([$interviewer, $interviewer2, $inactive])
            ->approvers([$approver, $approver2])
            ->create(['title' => 'Staf Programmer']);

        $questions = [];

        foreach (['Ceritakan proyek Anda.', 'Bagaimana Anda menguji kode?', 'Mengapa bergabung?'] as $index => $prompt) {
            $questions[] = HiringQuestion::factory()->create([
                'position_id' => $position->id,
                'prompt' => $prompt,
                'position' => $index + 1,
                'max_score' => 5,
            ]);
        }

        $candidate = Candidate::factory()->forPosition($position)->withChecklist()->create(['full_name' => 'Nadia Putri']);

        return (object) [
            'hr' => $hr,
            'admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
            'interviewer' => $interviewer,
            'interviewer2' => $interviewer2,
            'approver' => $approver,
            'approver2' => $approver2,
            'kadiv' => User::factory()->withRole(Role::KepalaDivisi)->create(),
            'direksi' => User::factory()->withRole(Role::Direksi)->create(),
            'anggota' => User::factory()->withRole(Role::Anggota)->create(),
            'foreign' => User::factory()->withRole(Role::Hr)->create(['company_id' => Company::factory()->create()->id]),
            'inactive' => $inactive,
            'position' => $position,
            'questions' => $questions,
            'candidate' => $candidate,
        ];
    }

    function hiringVerdict(User $user, string $ability, mixed $arguments): string
    {
        $response = Gate::forUser($user)->inspect($ability, $arguments);

        return $response->allowed() ? 'allow' : ($response->status() === 404 ? 'hidden' : 'deny');
    }

    /** Ticks every required HR & interviewer item so "Keputusan akhir" may be entered. */
    function hiringCompleteChecklist(Candidate $candidate): void
    {
        CandidateChecklistItem::query()
            ->where('candidate_id', $candidate->id)
            ->whereIn('role', ['hr', 'interviewer'])
            ->update(['checked_at' => now()]);
    }

    function hiringToFinal(object $world): Candidate
    {
        hiringCompleteChecklist($world->candidate);
        $world->candidate->forceFill(['stage' => CandidateStage::Assessment])->save();

        return $world->candidate->fresh() ?? $world->candidate;
    }
}
