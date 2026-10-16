<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Enums\NotificationChannel;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Self-hosted Evolution API gateway (docs/fitur/absensi-whatsapp.md): a
 * WhatsApp Web connection (Baileys) driven over REST. Used for the
 * management group copies — never for personal data the group must not see.
 *
 * The gateway is unofficial by nature: it must run on a dedicated gateway
 * number, stay rate-limited, and failures degrade quietly (the in-app record
 * stays the source of truth).
 */
final class EvolutionWhatsApp
{
    public function enabled(): bool
    {
        $url = config('services.evolution.url');

        return is_string($url)
            && $url !== ''
            && (string) config('services.evolution.api_key') !== ''
            && NotificationChannel::WhatsApp->isAvailable();
    }

    /**
     * Send a plain text message to a WhatsApp group jid ("…@g.us") or phone
     * number. Throws on transport/server errors so queued callers retry.
     *
     * @throws ConnectionException|RequestException
     */
    public function sendText(string $to, string $text): void
    {
        Http::baseUrl((string) config('services.evolution.url'))
            ->withHeaders(['apikey' => (string) config('services.evolution.api_key')])
            ->timeout(15)
            ->retry(2, 500, throw: false)
            ->acceptJson()
            ->post('/message/sendText/'.(string) config('services.evolution.instance'), [
                'number' => $to,
                'text' => $text,
                // A small human-looking pause before the gateway types.
                'delay' => 800,
            ])
            ->throw();
    }

    /**
     * Send a JPEG with a caption (Evolution API v2 `sendMedia`). The image is
     * passed as base64, so nothing is written to disk or exposed by URL.
     * Throws on transport/server errors so queued callers retry.
     *
     * @throws ConnectionException|RequestException
     */
    public function sendImage(string $to, string $imageBytes, string $caption, string $fileName = 'absensi.jpg'): void
    {
        Http::baseUrl((string) config('services.evolution.url'))
            ->withHeaders(['apikey' => (string) config('services.evolution.api_key')])
            ->timeout(30)
            ->acceptJson()
            ->post('/message/sendMedia/'.(string) config('services.evolution.instance'), [
                'number' => $to,
                'mediatype' => 'image',
                'mimetype' => 'image/jpeg',
                'media' => base64_encode($imageBytes),
                'fileName' => $fileName,
                'caption' => $caption,
                'delay' => 800,
            ])
            ->throw();
    }
}
