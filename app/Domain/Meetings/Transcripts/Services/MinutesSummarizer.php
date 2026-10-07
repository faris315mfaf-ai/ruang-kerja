<?php

namespace App\Domain\Meetings\Transcripts\Services;

use App\Models\Meeting;
use App\Models\MeetingTranscript;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * AI draft minutes from a transcript through any OpenAI-compatible chat
 * completions API (config/notulen.php `llm`, default DeepSeek). Indonesian
 * prompt, JSON output (ringkasan, per agenda: poin, keputusan, tindak
 * lanjut; perlu dicek), normalized by DraftNormalizer.
 *
 * Long transcripts are summarized map-reduce: each chunk of at most
 * `chunk_chars` becomes partial notes, then one call merges the parts.
 * Invalid JSON is repaired locally, then once by the model; after that the
 * job fails (the transcript itself is kept).
 */
final class MinutesSummarizer
{
    private const array DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    /** @var list<array{user_id: string, name: string}> */
    private array $participants = [];

    public function __construct(private readonly TranscriptConsents $consents) {}

    /**
     * @return array{draft: array<string, mixed>, model: string, calls: int}
     */
    public function summarize(MeetingTranscript $transcript, Meeting $meeting): array
    {
        $this->participants = $this->participantsOf($meeting, $transcript);
        $lines = $this->lines($transcript);
        $chunks = self::chunk($lines, max(2000, (int) config('notulen.llm.chunk_chars', 40000)));
        $calls = 0;
        $context = $this->context($transcript, $meeting);

        if (count($chunks) <= 1) {
            $raw = $this->ask($this->systemPrompt(), $context."\n\nTRANSKRIP:\n".implode("\n", $chunks[0] ?? []), $calls);
        } else {
            $parts = [];

            foreach ($chunks as $index => $chunk) {
                $parts[] = $this->ask(
                    $this->systemPrompt(),
                    $context."\n\nIni bagian ".($index + 1).' dari '.count($chunks)." transkrip. Catat hanya isi bagian ini.\n\nTRANSKRIP:\n".implode("\n", $chunk),
                    $calls,
                );
            }

            $raw = $this->ask(
                $this->systemPrompt(),
                $context."\n\nBerikut catatan sementara per bagian rapat (JSON, skema sama). Gabungkan menjadi SATU notulen utuh: "
                ."satukan butir yang sama, pertahankan nomor sumber, jangan menambah informasi baru.\n\n"
                .json_encode($parts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $calls,
            );
        }

        $normalizer = new DraftNormalizer($this->participants, array_map(
            fn (array $segment): int => (int) $segment['start_ms'],
            $transcript->segments,
        ));

        return ['draft' => $normalizer->normalize($raw), 'model' => (string) config('notulen.llm.model'), 'calls' => $calls];
    }

    /**
     * Transcript as numbered lines "[i] mm:ss Nama: teks".
     *
     * @return list<string>
     */
    public function lines(MeetingTranscript $transcript): array
    {
        $lines = [];

        foreach ($transcript->segments as $index => $segment) {
            $seconds = intdiv((int) $segment['start_ms'], 1000);
            $clock = $seconds >= 3600
                ? sprintf('%d:%02d:%02d', intdiv($seconds, 3600), intdiv($seconds % 3600, 60), $seconds % 60)
                : sprintf('%02d:%02d', intdiv($seconds, 60), $seconds % 60);
            $lines[] = "[{$index}] {$clock} {$segment['speaker_name']}: {$segment['text']}";
        }

        return $lines;
    }

    /**
     * Consecutive lines grouped so no group exceeds $limit characters.
     *
     * @param  list<string>  $lines
     * @return list<list<string>>
     */
    public static function chunk(array $lines, int $limit): array
    {
        $chunks = [];
        $current = [];
        $size = 0;

        foreach ($lines as $line) {
            $length = mb_strlen($line) + 1;

            if ($current !== [] && $size + $length > $limit) {
                $chunks[] = $current;
                $current = [];
                $size = 0;
            }

            $current[] = mb_substr($line, 0, $limit);
            $size += $length;
        }

        if ($current !== []) {
            $chunks[] = $current;
        }

        return $chunks;
    }

    private function systemPrompt(): string
    {
        return <<<'PROMPT'
        Anda notulis rapat kantor yang teliti. Tulis dalam Bahasa Indonesia baku yang ringkas.
        Jawab HANYA dengan satu objek JSON valid, tanpa teks lain, dengan skema:
        {
          "ringkasan": "3-6 kalimat inti rapat",
          "agenda": [
            {
              "judul": "judul butir agenda (pakai judul dari daftar agenda bila cocok)",
              "poin": [{"teks": "poin pembahasan", "sumber": [nomor baris transkrip]}],
              "keputusan": [{"teks": "keputusan yang disepakati", "sumber": [nomor baris]}],
              "tindak_lanjut": [{"judul": "tugas konkret", "penanggung_jawab": "nama PERSIS dari daftar peserta atau null", "tenggat": "YYYY-MM-DD atau null", "sumber": [nomor baris]}]
            }
          ],
          "perlu_dicek": ["hal yang tidak jelas, bertentangan, atau perlu dipastikan"]
        }
        Aturan:
        - Hanya isi yang benar-benar diucapkan di transkrip. Jangan mengarang.
        - "sumber" berisi nomor dalam kurung siku di awal baris transkrip, mis. [12].
        - Penanggung jawab HANYA orang di DAFTAR PESERTA (yang berbicara di rapat). Bila orangnya tidak jelas atau tidak ada di daftar, isi null dan tulis di "perlu_dicek".
        - Tenggat relatif ("Jumat ini", "minggu depan") diubah ke tanggal berdasarkan TANGGAL RAPAT; bila tidak pasti isi null dan tulis di "perlu_dicek".
        - Keputusan = hal yang disepakati, bukan sekadar usulan.
        PROMPT;
    }

    private function context(MeetingTranscript $transcript, Meeting $meeting): string
    {
        $date = CarbonImmutable::parse($transcript->occurrence_date->toDateString(), config()->string('app.office_timezone'));
        $people = implode("\n", array_map(fn (array $p): string => '- '.$p['name'], $this->participants));
        $agenda = $meeting->agenda === [] ? '(tidak ada)' : implode("\n", array_map(fn (string $item): string => '- '.$item, $meeting->agenda));

        return 'JUDUL RAPAT: '.$meeting->title."\n"
            .'TANGGAL RAPAT: '.$date->toDateString().' ('.self::DAYS[$date->dayOfWeekIso - 1].")\n"
            ."DAFTAR AGENDA:\n{$agenda}\n"
            ."DAFTAR PESERTA:\n{$people}";
    }

    /**
     * People the model may name (data minimisation): meeting participants who
     * actually speak in the transcript and did not opt out. Only their
     * display names are sent; ids stay here for matching, e-mails never leave.
     *
     * @return list<array{user_id: string, name: string}>
     */
    private function participantsOf(Meeting $meeting, MeetingTranscript $transcript): array
    {
        $meeting->loadMissing('participants.user:id,name');
        $speaking = array_flip(array_filter(array_map(fn (array $s): ?string => $s['user_id'], $transcript->segments)));
        $optedOut = array_flip($this->consents->optedOutIds($meeting));
        $people = [];

        foreach ($meeting->participants as $participant) {
            $id = (string) $participant->user_id;

            if ($participant->user !== null && isset($speaking[$id]) && ! isset($optedOut[$id])) {
                $people[$id] = ['user_id' => $id, 'name' => $participant->user->name];
            }
        }

        return array_values($people);
    }

    /**
     * One chat completion → decoded JSON object (repairs once).
     *
     * @return array<string, mixed>
     */
    private function ask(string $system, string $user, int &$calls): array
    {
        $reply = $this->complete([
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ], $calls);
        $decoded = DraftNormalizer::decode($reply);

        if ($decoded !== null) {
            return $decoded;
        }

        $repaired = $this->complete([
            ['role' => 'system', 'content' => 'Perbaiki teks berikut menjadi satu objek JSON valid dengan isi dan skema yang sama. Jawab hanya JSON.'],
            ['role' => 'user', 'content' => mb_substr($reply, 0, 60000)],
        ], $calls);

        return DraftNormalizer::decode($repaired)
            ?? throw new RuntimeException('Ringkasan AI tidak berbentuk JSON yang valid.');
    }

    /**
     * @param  list<array{role: string, content: string}>  $messages
     */
    private function complete(array $messages, int &$calls): string
    {
        $calls++;
        $retries = max(0, (int) config('notulen.llm.retries', 2));

        try {
            /** @var Response $response */
            $response = Http::baseUrl((string) config('notulen.llm.base_url'))
                ->withToken((string) config('notulen.llm.api_key'))
                ->acceptJson()
                ->timeout(max(10, (int) config('notulen.llm.timeout', 120)))
                ->retry($retries + 1, 2000, fn (\Throwable $e): bool => $e instanceof ConnectionException
                    || ($e instanceof RequestException && ($e->response->status() === 429 || $e->response->serverError())))
                ->post('/chat/completions', [
                    'model' => (string) config('notulen.llm.model'),
                    'messages' => $messages,
                    'temperature' => 0.2,
                    'max_tokens' => max(500, (int) config('notulen.llm.max_tokens', 4000)),
                    'response_format' => ['type' => 'json_object'],
                ])
                ->throw();
        } catch (ConnectionException|RequestException $exception) {
            $status = $exception instanceof RequestException ? 'HTTP '.$exception->response->status() : 'tidak terjangkau';

            throw new RuntimeException("Layanan ringkasan AI {$status}.", 0, $exception);
        }

        $content = $response->json('choices.0.message.content');

        if (! is_string($content) || trim($content) === '') {
            throw new RuntimeException('Layanan ringkasan AI tidak mengembalikan isi.');
        }

        return $content;
    }
}
