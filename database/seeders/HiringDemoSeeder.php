<?php

namespace Database\Seeders;

use App\Domain\Hiring\Actions\CreateHiringPosition;
use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\DecisionValue;
use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Enums\ReviewerRole;
use App\Domain\Hiring\Services\CandidateChecklist;
use App\Domain\Hiring\Services\ChecklistTemplate;
use App\Domain\Organization\Demo\DemoCompany;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateDecision;
use App\Models\CandidateNote;
use App\Models\Division;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\HiringSetting;
use App\Models\InterviewAnswer;
use App\Models\InterviewScore;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Hiring demo (local/testing): Faris & Dio as default final approvers, one
 * open position "Staf Programmer Backend" (interviewers Dimas & Arif) with
 * five questions and six candidates across the stages. Writes models
 * directly (no notifications, no audit). Idempotent. Needs DemoUserSeeder
 * (Faris & Dio are demo accounts) and OrganizationSeeder (interviewers).
 */
class HiringDemoSeeder extends Seeder
{
    public const string POSITION_TITLE = 'Staf Programmer Backend';

    /** @var list<array{0: string, 1: string}> */
    private const array QUESTIONS = [
        ['Ceritakan proyek backend yang paling Anda banggakan dan peran Anda di dalamnya.', 'Cari kontribusi pribadi, bukan hanya proyek tim.'],
        ['Bagaimana Anda merancang tabel dan indeks untuk fitur absensi harian puluhan karyawan?', 'Nilai pemahaman PostgreSQL, indeks, dan zona waktu.'],
        ['Apa yang Anda lakukan saat menemukan bug di produksi pada jam kerja?', 'Prioritas, komunikasi, dan langkah pemulihan.'],
        ['Bagaimana Anda menulis test untuk alur persetujuan bertingkat?', 'Pest/PHPUnit, data uji, kasus tepi.'],
        ['Mengapa Anda tertarik bergabung dengan tim kami?', 'Motivasi dan kecocokan budaya kerja.'],
    ];

    /**
     * email => [name, stage, source, days ago]
     *
     * @var array<string, array{0: string, 1: CandidateStage, 2: CandidateSource, 3: int}>
     */
    private const array CANDIDATES = [
        'nadia.putri@contoh.id' => ['Nadia Putri', CandidateStage::Applied, CandidateSource::GoogleForm, 1],
        'galih.pratama@contoh.id' => ['Galih Pratama', CandidateStage::Screening, CandidateSource::GoogleForm, 4],
        'intan.permata@contoh.id' => ['Intan Permata', CandidateStage::Interview, CandidateSource::Manual, 7],
        'yoga.firmansyah@contoh.id' => ['Yoga Firmansyah', CandidateStage::Assessment, CandidateSource::GoogleForm, 10],
        'ratna.kusuma@contoh.id' => ['Ratna Kusuma', CandidateStage::FinalReview, CandidateSource::GoogleForm, 14],
        'dwi.santoso@contoh.id' => ['Dwi Santoso', CandidateStage::Hired, CandidateSource::GoogleForm, 21],
    ];

    public function run(): void
    {
        $company = DemoCompany::ensure();
        $users = User::query()
            ->whereIn('email', ['faris@demo.test', 'dio@demo.test', 'kadiv@demo.test', 'programmer@demo.test', 'hr@demo.test'])
            ->get()
            ->keyBy('email');

        $faris = $users->get('faris@demo.test');
        $dio = $users->get('dio@demo.test');
        $hr = $users->get('hr@demo.test');

        if ($faris === null || $dio === null || $hr === null) {
            return;
        }

        HiringSetting::query()->updateOrCreate(
            ['company_id' => $company->id],
            ['default_final_approver_ids' => [$faris->id, $dio->id], 'checklist_template' => ChecklistTemplate::defaults()],
        );

        $interviewers = array_values(array_filter([
            $users->get('kadiv@demo.test')?->id,
            $users->get('programmer@demo.test')?->id,
        ]));

        $position = HiringPosition::query()->firstOrNew(['company_id' => $company->id, 'title' => self::POSITION_TITLE]);

        if (! $position->exists) {
            $position->fill([
                'division_id' => Division::query()->where('company_id', $company->id)->where('code', 'PRG')->value('id'),
                'description' => "Membangun dan merawat layanan backend (Laravel, PostgreSQL) untuk aplikasi internal.\nPengalaman minimal 2 tahun.",
                'status' => PositionStatus::Open,
                'opened_at' => CarbonImmutable::now()->subDays(30),
                'webhook_token' => CreateHiringPosition::token(),
                'webhook_secret' => Str::random(48),
                'field_map' => [],
                'created_by' => $hr->id,
            ]);
        }

        $position->fill([
            'interviewer_ids' => $interviewers,
            'final_approver_ids' => [$faris->id, $dio->id],
        ])->save();

        $questions = collect(self::QUESTIONS)->map(fn (array $question, int $index): HiringQuestion => HiringQuestion::query()->updateOrCreate(
            ['position_id' => $position->id, 'position' => $index + 1],
            ['prompt' => $question[0], 'guidance' => $question[1], 'max_score' => 5],
        ));

        foreach (self::CANDIDATES as $email => [$name, $stage, $source, $daysAgo]) {
            $this->candidate($position, $questions->all(), $email, $name, $stage, $source, $daysAgo, $hr, $faris, $dio);
        }
    }

    /**
     * @param  list<HiringQuestion>  $questions
     */
    private function candidate(
        HiringPosition $position,
        array $questions,
        string $email,
        string $name,
        CandidateStage $stage,
        CandidateSource $source,
        int $daysAgo,
        User $hr,
        User $faris,
        User $dio,
    ): void {
        $candidate = Candidate::withTrashed()->firstOrNew(['position_id' => $position->id, 'email' => $email]);

        if ($candidate->exists) {
            return;
        }

        $appliedAt = CarbonImmutable::now()->subDays($daysAgo)->setTime(9, 30);
        $fromForm = $source === CandidateSource::GoogleForm;
        $cv = 'https://drive.google.com/file/d/demo-cv-'.Str::slug($name).'/view';

        $candidate->fill([
            'company_id' => $position->company_id,
            'full_name' => $name,
            'phone' => '0812'.substr(md5($email), 0, 8),
            'cv_url' => $cv,
            'attachments' => $fromForm ? [['label' => 'CV', 'url' => $cv], ['label' => 'Portofolio (opsional)', 'url' => 'https://github.com/'.Str::slug($name)]] : [],
            'form_answers' => $fromForm ? [
                ['question' => 'Nama lengkap', 'answer' => $name],
                ['question' => 'Email', 'answer' => $email],
                ['question' => 'No. HP', 'answer' => '0812'.substr(md5($email), 0, 8)],
                ['question' => 'Pengalaman kerja (tahun)', 'answer' => (string) (2 + $daysAgo % 4)],
                ['question' => 'Bahasa & framework yang dikuasai', 'answer' => 'PHP, Laravel, PostgreSQL, Redis'],
                ['question' => 'Ekspektasi gaji', 'answer' => 'Sesuai kebijakan perusahaan'],
            ] : [],
            'external_response_id' => $fromForm ? 'demo-'.Str::slug($name) : null,
            'stage' => $stage,
            'rejected_reason' => null,
            'source' => $source,
            'applied_at' => $appliedAt,
            'decided_at' => $stage->isFinal() ? CarbonImmutable::now()->subDays(1) : null,
            'created_by' => $fromForm ? null : $hr->id,
        ])->save();

        app(CandidateChecklist::class)->seed($candidate, $position);

        $order = array_search($stage, CandidateStage::cases(), true);
        $interviewed = $order >= array_search(CandidateStage::Assessment, CandidateStage::cases(), true);

        // Checklist: HR items from "Seleksi berkas" on; reviewer items once interviewed.
        CandidateChecklistItem::query()->where('candidate_id', $candidate->id)->get()
            ->each(function (CandidateChecklistItem $item) use ($order, $interviewed, $stage, $hr): void {
                $done = match ($item->role) {
                    ReviewerRole::Hr => $order >= 1 && ($item->is_required || $interviewed),
                    ReviewerRole::Interviewer => $interviewed,
                    ReviewerRole::Approver => $stage === CandidateStage::Hired,
                };

                if ($done) {
                    $item->forceFill([
                        'checked_at' => CarbonImmutable::now()->subDays(2),
                        'checked_by' => $item->reviewer_id ?? $hr->id,
                    ])->save();
                }
            });

        if ($order >= array_search(CandidateStage::Interview, CandidateStage::cases(), true)) {
            foreach ($questions as $index => $question) {
                InterviewAnswer::query()->create([
                    'candidate_id' => $candidate->id,
                    'question_id' => $question->id,
                    'answer' => $this->answer($name, $index),
                    'recorded_by' => $hr->id,
                ]);

                foreach ($position->interviewer_ids as $offset => $interviewerId) {
                    if (! $interviewed && $offset > 0) {
                        continue; // Interview stage: only the first interviewer scored so far.
                    }

                    InterviewScore::query()->create([
                        'candidate_id' => $candidate->id,
                        'question_id' => $question->id,
                        'interviewer_id' => $interviewerId,
                        'score' => 3 + (($index + $offset + strlen($name)) % 3),
                        'note' => $index === 0 ? 'Penjelasan runtut dan konkret.' : null,
                    ]);
                }
            }

            CandidateNote::query()->create([
                'candidate_id' => $candidate->id,
                'author_id' => $position->interviewer_ids[0] ?? $hr->id,
                'body' => "Wawancara teknis 45 menit.\n- Kuat di desain basis data.\n- Perlu pendalaman di pengujian otomatis.",
            ]);
        }

        if ($stage === CandidateStage::FinalReview || $stage === CandidateStage::Hired) {
            CandidateDecision::query()->create([
                'candidate_id' => $candidate->id,
                'approver_id' => $faris->id,
                'decision' => DecisionValue::Approve,
                'note' => 'Setuju, cocok dengan kebutuhan tim.',
                'decided_at' => CarbonImmutable::now()->subDays(1),
            ]);

            // Faris ticked his review item before approving.
            CandidateChecklistItem::query()->where('candidate_id', $candidate->id)->where('reviewer_id', $faris->id)
                ->update(['checked_at' => CarbonImmutable::now()->subDays(1), 'checked_by' => $faris->id]);
        }

        if ($stage === CandidateStage::Hired) {
            CandidateDecision::query()->create([
                'candidate_id' => $candidate->id,
                'approver_id' => $dio->id,
                'decision' => DecisionValue::Approve,
                'note' => null,
                'decided_at' => CarbonImmutable::now()->subDays(1),
            ]);
        }
    }

    private function answer(string $name, int $index): string
    {
        $first = Str::before($name, ' ');

        return [
            "{$first} memimpin migrasi layanan absensi ke Laravel; menulis ulang 30 endpoint dan menurunkan waktu respons 40%.",
            'Satu baris per karyawan per tanggal, unik (user_id, work_date), waktu UTC, tanggal kerja menurut zona kantor.',
            'Cek log dan dampak, kabari tim, rollback bila perlu, lalu tulis test regresi.',
            'Test fitur per langkah persetujuan, termasuk penyetuju cuti dan delegasi.',
            'Ingin membangun alat internal yang dipakai langsung oleh rekan kerja.',
        ][$index] ?? '';
    }
}
