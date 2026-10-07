<?php

namespace App\Domain\Meetings\Transcripts\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * App → worker API (transcriber/notulen/server.py): join a room, relay a
 * consent change, finish a room. Signed bodies (NotulenSignature) carry the
 * action, the room and a random nonce. Called from queued jobs only.
 */
final class TranscriberClient
{
    public function __construct(
        private readonly NotulenConfig $config,
        private readonly NotulenSignature $signature,
    ) {}

    /**
     * @param  list<string>  $exclude  identities that must never be recorded
     * @return string worker status ("joining", "already")
     */
    public function join(string $room, string $token, array $exclude): string
    {
        return $this->send($room, 'join', ['token' => $token, 'exclude' => $exclude], [200, 202]);
    }

    public function exclude(string $room, string $identity, bool $excluded): string
    {
        return $this->send($room, 'exclude', ['identity' => $identity, 'excluded' => $excluded], [200]);
    }

    /** "finishing", or "unknown" when the worker was not recording that room. */
    public function finish(string $room): string
    {
        return $this->send($room, 'finish', [], [202, 404]);
    }

    /**
     * @param  array<string, mixed>  $fields
     * @param  list<int>  $accepted
     */
    private function send(string $room, string $action, array $fields, array $accepted): string
    {
        if (! $this->config->configured()) {
            throw new RuntimeException('Transcriber is not configured.');
        }

        $body = (string) json_encode(
            ['action' => $action, 'room' => $room, ...$fields, 'nonce' => bin2hex(random_bytes(8))],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );

        try {
            $response = Http::timeout(max(2, (int) config('notulen.transcriber.timeout', 10)))
                ->acceptJson()
                ->withHeaders($this->signature->headers($body))
                ->withBody($body, 'application/json')
                ->post($this->config->url().'/rooms/'.$room.'/'.$action);
        } catch (ConnectionException $exception) {
            throw new RuntimeException("Transcriber {$action} unreachable: ".$exception->getMessage(), 0, $exception);
        }

        if (! in_array($response->status(), $accepted, true)) {
            throw new RuntimeException("Transcriber {$action} answered HTTP {$response->status()}.");
        }

        $status = $response->json('status');

        return is_string($status) ? $status : 'ok';
    }
}
