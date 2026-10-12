<?php

namespace App\Domain\Organization\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * "Kirim tautan ke email saya" from the mobile app: a link to a web-only page,
 * mailed to the signed-in user's own address.
 */
final class DesktopLinkMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $recipientName,
        public readonly string $url,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Tautan untuk dibuka di komputer');
    }

    public function content(): Content
    {
        return new Content(
            html: 'mail.desktop-link',
            text: 'mail.desktop-link-text',
            with: [
                'firstName' => str($this->recipientName)->before(' ')->toString(),
                'url' => $this->url,
            ],
        );
    }
}
