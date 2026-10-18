<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Division;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Routing\Middleware\ThrottleRequestsWithRedis;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\View as ViewFacade;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Illuminate\View\View;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Fase 1 multi-perusahaan — every GET page, JSON endpoint and export that a
 * company A employee can open (no parameter, or only A's own records / a
 * format / an enum), as Super Admin, HR, Direksi, Kepala Divisi and Anggota of
 * A. The response — HTML with the Inertia page, every deferred prop, JSON,
 * the cells of an .xlsx, the text streams of a .pdf — must not contain
 * company B: neither its marker ZZB0C0R nor the id of any of its rows.
 *
 * Three variants per URL: as is; with ?q=ZZB0C (search: matches B's names,
 * while the echoed query never contains the full marker); and with the common
 * filters pointing at B's records (?divisi=…&workspace_id=…; marker check
 * only, since the echoed filters contain B ids).
 *
 * Gaps found are listed in knownListingGaps() (docs/sesi/fase1-celah.md).
 */

/**
 * @return array<string, string>
 */
function listingLeakExceptions(): array
{
    return [
        'horizon*' => 'Horizon: data antrean server (gerbang viewHorizon)',
        'pulse*' => 'Laravel Pulse: metrik server (gerbang viewPulse)',
        'livewire-*' => 'Aset Livewire (Pulse)',
        '_inertia/*' => 'Inertia devtools (lokal)',
        'up' => 'Health check',
        'health' => 'Health check',
        'sanctum/csrf-cookie' => 'Cookie CSRF',
        'storage/{path}' => 'Berkas publik lokal',
    ];
}

/**
 * Leaks found by this suite ("variant METHOD uri @role" => docs/sesi/fase1-celah.md row).
 *
 * @return array<string, string>
 */
function knownListingGaps(): array
{
    return [
        // C1: system audit entries (user_id null) are visible to every company's auditor.
        'polos GET admin/audit @super_admin' => 'C1',
        'cari GET admin/audit @super_admin' => 'C1',
        'filter GET admin/audit @super_admin' => 'C1',
    ];
}

/**
 * Data of every view rendered since the last call (PDF exports are rendered
 * from a Blade view; their text is not searchable inside the PDF itself, the
 * embedded font encodes glyph ids).
 */
function listingLeakViews(bool $reset = false): string
{
    static $captured = [];
    static $factory = null;

    // One listener per application instance (every test boots a new one).
    $listening = $factory === spl_object_id(app('view'));

    if (! $listening || $reset) {
        $captured = [];
    }

    if (! $listening) {
        $factory = spl_object_id(app('view'));
        ViewFacade::composer('*', function (View $view) use (&$captured): void {
            $captured[] = (string) json_encode($view->getData(), JSON_PARTIAL_OUTPUT_ON_ERROR);
        });
    }

    $text = implode("\n", $captured);
    $captured = [];

    return $text;
}

/**
 * Text of any response: JSON/HTML as is, streamed and file downloads read,
 * .xlsx unzipped (all XML parts), .pdf with its Flate streams inflated plus
 * the data of the view it was rendered from (listingLeakViews()).
 */
function listingLeakBody(TestResponse $response): string
{
    $base = $response->baseResponse;

    $content = match (true) {
        $base instanceof StreamedResponse => $response->streamedContent(),
        $base instanceof BinaryFileResponse => (string) file_get_contents($base->getFile()->getPathname()),
        default => (string) $response->getContent(),
    };

    if (str_starts_with($content, 'PK')) {
        $path = tempnam(sys_get_temp_dir(), 'rk-xlsx');
        file_put_contents((string) $path, $content);
        $zip = new ZipArchive;
        $text = '';

        if ($zip->open((string) $path) === true) {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $text .= (string) $zip->getFromIndex($i);
            }

            $zip->close();
        }

        @unlink((string) $path);

        return $text;
    }

    if (str_starts_with($content, '%PDF')) {
        preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $content, $streams);

        foreach ($streams[1] as $stream) {
            $inflated = @gzuncompress($stream);
            $content .= is_string($inflated) ? $inflated : '';
        }

        $content .= listingLeakViews();
    }

    return $content;
}

/**
 * GET URLs of company A to visit: routes without parameters, plus routes whose
 * parameters are A's own records, a file format or an enum (every case).
 *
 * @return array<string, string> url => route uri
 */
function listingLeakUrls(object $home): array
{
    $own = [
        Workspace::class => $home->workspace->id,
        User::class => $home->anggota->id,
        Task::class => $home->task->id,
        Division::class => $home->division->id,
    ];
    $urls = [];

    /** @var Route $route */
    foreach (app('router')->getRoutes() as $route) {
        $uri = $route->uri();

        if (! in_array('GET', $route->methods(), true)) {
            continue;
        }

        foreach (array_keys(listingLeakExceptions()) as $pattern) {
            if ($pattern === $uri || fnmatch($pattern, $uri, FNM_NOESCAPE)) {
                continue 2;
            }
        }

        $types = [];

        foreach ($route->signatureParameters() as $parameter) {
            $type = $parameter->getType();
            $types[$parameter->getName()] = $type instanceof ReflectionNamedType ? $type->getName() : '';
        }

        $choices = [[]];

        foreach ($route->parameterNames() as $name) {
            $type = $types[$name] ?? '';
            $values = match (true) {
                isset($own[$type]) => [$own[$type]],
                $type !== '' && enum_exists($type) => array_map(fn (BackedEnum $case): string => (string) $case->value, $type::cases()),
                $name === 'format' => explode('|', (string) ($route->wheres['format'] ?? 'xlsx')),
                $name === 'date' => [now(config()->string('app.office_timezone'))->toDateString()],
                $name === 'user' => [$home->anggota->id],
                $name === 'number' => [(string) $home->task->number],
                default => null,
            };

            if ($values === null) {
                continue 2;
            }

            $choices = array_merge(...array_map(fn (array $chosen): array => array_map(fn (string $value): array => [...$chosen, $name => $value], $values), $choices));
        }

        foreach ($choices as $values) {
            $path = preg_replace_callback('/\{(\w+)\??\}/', fn (array $match): string => $values[$match[1]] ?? '', $uri) ?? '';
            $urls['/'.trim($path, '/')] = $uri;
        }
    }

    return $urls;
}

beforeEach(function () {
    $this->withoutMiddleware([ThrottleRequests::class, ThrottleRequestsWithRedis::class]);
});

test('the detector sees company B in B\'s own pages and exports (positive control)', function () {
    homeWorld();
    $foreign = foreignWorld();
    $month = now(config()->string('app.office_timezone'))->format('Y-m');

    $read = function (string $url, ?User $as = null) use ($foreign): string {
        listingLeakViews(reset: true);

        return listingLeakBody($this->actingAs($as ?? $foreign->hr, 'web')->get($url)->assertOk());
    };

    expect(leaksForeign($read('/admin/karyawan')))->toBeTrue()
        ->and(leaksForeign($read('/absensi/rekap/ekspor/xlsx?bulan='.$month)))->toBeTrue()
        ->and(leaksForeign($read('/absensi/rekap/ekspor/pdf?bulan='.$month)))->toBeTrue()
        ->and(leaksForeign($read('/privasi/ekspor/xlsx', $foreign->anggota)))->toBeTrue()
        ->and(leaksForeign($read('/w/'.$foreign->teamWorkspace->key, $foreign->kadiv)))->toBeTrue();
});

test('company A pages, JSON endpoints and exports never show company B', function () {
    $home = homeWorld();
    $foreign = foreignWorld();

    Http::fake();
    Queue::fake();
    Mail::fake();
    Notification::fake();

    $foreignIds = tenancyRowIds($foreign->company->id);
    $pattern = '/'.implode('|', array_map(fn (string $id): string => preg_quote($id, '/'), $foreignIds)).'/i';
    $filters = http_build_query([
        'divisi' => $foreign->division->id,
        'division_id' => $foreign->division->id,
        'workspace' => $foreign->teamWorkspace->id,
        'workspace_id' => $foreign->teamWorkspace->id,
        'proyek' => $foreign->projectWorkspace->id,
        'user_id' => $foreign->anggota->id,
        'karyawan' => $foreign->anggota->id,
        'tim' => $foreign->team->id,
        'team_id' => $foreign->team->id,
        'lowongan' => $foreign->hiringPosition->id,
    ]);
    $variants = ['' => true, 'q=ZZB0C' => true, $filters => false];
    $actors = ['super_admin' => $home->superAdmin, 'hr' => $home->hr, 'direksi' => $home->direksi, 'kepala_divisi' => $home->kadiv, 'anggota' => $home->anggota];
    $urls = listingLeakUrls($home);
    $version = null;
    $failures = [];
    $answered = 0;

    foreach ($urls as $url => $uri) {
        $api = str_starts_with($uri, 'api/');

        foreach ($variants as $query => $checkIds) {
            $full = $query === '' ? $url : $url.'?'.$query;
            $label = ($query === '' ? 'polos' : (str_starts_with($query, 'q=') ? 'cari' : 'filter'))." GET {$uri}";

            foreach ($actors as $role => $actor) {
                // A fresh session: redirect()->back() must not point at the previous (filter) URL.
                $this->flushSession();
                listingLeakViews(reset: true);
                app(AuthFactory::class)->forgetGuards();
                $actor = User::query()->findOrFail($actor->id);

                if ($api) {
                    Sanctum::actingAs($actor);
                    $response = $this->getJson($full);
                } else {
                    $response = $this->actingAs($actor, 'web')->get($full);
                }

                $status = $response->getStatusCode();
                $answered += $status >= 200 && $status < 300 ? 1 : 0;
                $bodies = [listingLeakBody($response)];

                // Deferred Inertia props: reload them like the browser does.
                $page = ! $api && $status === 200 && ($response->baseResponse->original ?? null) instanceof View ? $response->viewData('page') : null;
                $deferred = is_array($page) ? ($page['deferredProps'] ?? []) : [];

                if ($deferred !== []) {
                    $version ??= (string) app(HandleInertiaRequests::class)->version(request());
                    $bodies[] = (string) $this->actingAs($actor, 'web')->get($full, [
                        'X-Inertia' => 'true',
                        'X-Inertia-Version' => $version,
                        'X-Inertia-Partial-Component' => $page['component'],
                        'X-Inertia-Partial-Data' => implode(',', array_merge(...array_values($deferred))),
                    ])->getContent();
                }

                foreach ($bodies as $body) {
                    $problem = match (true) {
                        leaksForeign($body) => 'memuat penanda ZZB0C0R',
                        $checkIds && preg_match($pattern, $body, $hit) === 1 => 'memuat id baris B '.$hit[0],
                        default => null,
                    };

                    if ($problem !== null) {
                        $failures["{$label} @{$role}"] = "{$problem} ({$status})";
                    }
                }

                if ($status >= 500) {
                    $failures["{$label} @{$role}"] = "galat server {$status}: ".class_basename($response->exception ?? new stdClass).' '.Str::limit((string) $response->exception?->getMessage(), 160);
                }
            }
        }
    }

    $known = knownListingGaps();
    $unexpected = array_diff_key($failures, $known);
    $fixed = array_diff_key($known, $failures);

    tenancyReport(sprintf("\n[tenancy] URL diuji: %d × 3 varian × 5 peran · 2xx: %d · celah tercatat: %d\n", count($urls), $answered, count($known)));

    foreach ($unexpected as $key => $problem) {
        tenancyReport("[tenancy] {$key}: {$problem}\n");
    }

    expect($unexpected)->toBe([], 'Kebocoran baru (catat di docs/sesi/fase1-celah.md + knownListingGaps() atau perbaiki)')
        ->and($fixed)->toBe([], 'Celah tercatat sudah tertutup: hapus dari knownListingGaps()')
        ->and(count($urls))->toBeGreaterThanOrEqual(150)
        ->and($answered)->toBeGreaterThanOrEqual(500);
});
