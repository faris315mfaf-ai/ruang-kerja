<?php

namespace App\Domain\Hiring\Enums;

/**
 * Masuk → Seleksi berkas → Wawancara → Penilaian → Keputusan akhir →
 * Diterima / Ditolak. HR moves candidates between the stages; Diterima is
 * only reached through the final approvers (DecideCandidate).
 */
enum CandidateStage: string
{
    case Applied = 'applied';
    case Screening = 'screening';
    case Interview = 'interview';
    case Assessment = 'assessment';
    case FinalReview = 'final_review';
    case Hired = 'hired';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Applied => 'Masuk',
            self::Screening => 'Seleksi berkas',
            self::Interview => 'Wawancara',
            self::Assessment => 'Penilaian',
            self::FinalReview => 'Keputusan akhir',
            self::Hired => 'Diterima',
            self::Rejected => 'Ditolak',
        };
    }

    public function isFinal(): bool
    {
        return $this === self::Hired || $this === self::Rejected;
    }

    /**
     * Stages HR may move a candidate to by hand (Diterima comes from the approvers).
     */
    public function isManualTarget(): bool
    {
        return $this !== self::Hired;
    }

    /**
     * Still in the pipeline (not decided).
     *
     * @return list<self>
     */
    public static function open(): array
    {
        return [self::Applied, self::Screening, self::Interview, self::Assessment, self::FinalReview];
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $stage): string => $stage->value, self::cases());
    }
}
