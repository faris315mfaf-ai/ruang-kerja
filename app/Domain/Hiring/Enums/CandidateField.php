<?php

namespace App\Domain\Hiring\Enums;

/**
 * Candidate fields filled from a Google Form answer (hiring_positions.field_map
 * maps a Form question title to each; aliases() are the built-in guesses).
 */
enum CandidateField: string
{
    case FullName = 'full_name';
    case Email = 'email';
    case Phone = 'phone';
    case CvUrl = 'cv_url';

    public function label(): string
    {
        return match ($this) {
            self::FullName => 'Nama lengkap',
            self::Email => 'Email',
            self::Phone => 'No. HP',
            self::CvUrl => 'CV',
        };
    }

    /**
     * Question titles recognised when the position has no mapping (lower case,
     * compared after trimming and collapsing spaces).
     *
     * @return list<string>
     */
    public function aliases(): array
    {
        return match ($this) {
            self::FullName => ['nama lengkap', 'nama', 'full name', 'name'],
            self::Email => ['email', 'e-mail', 'alamat email', 'surel', 'email address'],
            self::Phone => ['no. hp', 'no hp', 'nomor hp', 'no. telepon', 'nomor telepon', 'telepon', 'no. whatsapp', 'nomor whatsapp', 'whatsapp', 'phone'],
            self::CvUrl => ['cv', 'curriculum vitae', 'cv / resume', 'resume', 'unggah cv', 'upload cv', 'tautan cv', 'link cv'],
        };
    }
}
