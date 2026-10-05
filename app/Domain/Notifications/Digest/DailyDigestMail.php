<?php

namespace App\Domain\Notifications\Digest;

use App\Domain\Notifications\Digest\Data\DailyDigest;
use App\Domain\Notifications\Support\IndonesianDate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * Daily digest email (mockup EmailRingkasan): KPI tiles + one block per section.
 */
final class DailyDigestMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  string  $sendTime  the user's digest time "HH:MM" (office timezone), shown in the footer
     */
    public function __construct(
        public readonly DailyDigest $digest,
        public readonly string $sendTime = '07:30',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Ringkasan harian · '.$this->formattedDate(),
        );
    }

    public function content(): Content
    {
        return new Content(
            html: 'mail.daily-digest',
            text: 'mail.daily-digest-text',
            with: [
                'digest' => $this->digest,
                'firstName' => Str::before($this->digest->user->name, ' '),
                'dateLabel' => $this->formattedDate(),
                'greeting' => $this->greeting(),
                'appUrl' => url('/dashboard'),
                'inboxUrl' => url('/inbox'),
                'browserUrl' => url('/pengaturan/notifikasi/pratinjau-ringkasan'),
                'settingsUrl' => url('/pengaturan/notifikasi'),
                'sendTimeLabel' => str_replace(':', '.', substr($this->sendTime, 0, 5)),
            ],
        );
    }

    /**
     * "Senin, 5 Okt 2026".
     */
    public function formattedDate(): string
    {
        return IndonesianDate::long($this->digest->date);
    }

    private function greeting(): string
    {
        $hour = now()->setTimezone((string) config('app.office_timezone'))->hour;

        return match (true) {
            $hour < 11 => 'Selamat pagi',
            $hour < 15 => 'Selamat siang',
            $hour < 19 => 'Selamat sore',
            default => 'Selamat malam',
        };
    }
}
