<?php

use App\Models\User;
use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Illuminate\Contracts\Routing\UrlRoutable;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Routing\Middleware\ThrottleRequestsWithRedis;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpFoundation\StreamedResponse;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Fase 1 multi-perusahaan — every route with a parameter, called with the
 * records of company B by the strongest actors of company A (Super Admin,
 * HR, Direksi):
 *
 * - GET must answer 401/403/404/410 or redirect to the login page;
 * - POST/PUT/PATCH/DELETE (empty payload) must not answer 2xx;
 * - and no row of company B may change (tenancyFingerprint, which follows
 *   config/tenancy.php), whatever the status.
 *
 * Routes that cannot be called this way are listed in ROUTE_EXCEPTIONS with
 * the reason. Gaps found by this suite are listed in KNOWN_ROUTE_GAPS, each
 * pointing at its row in docs/sesi/fase1-celah.md (Langkah 2 closes them;
 * an entry that no longer fails makes this test fail, so the list shrinks).
 */

/**
 * Routes outside this test (uri pattern => reason). `*` matches anything.
 *
 * @return array<string, string>
 */
function routeLeakExceptions(): array
{
    return [
        // Infrastructure dashboards, gated by their own gates (no company data model).
        'horizon/*' => 'Horizon: gerbang viewHorizon (Super Admin), data antrean server',
        'livewire-*' => 'Aset Livewire (Pulse)',
        '_inertia/*' => 'Inertia devtools (lokal)',
        'storage/{path}' => 'Berkas publik lokal (disk public)',
        'email/verify/{id}/{hash}' => 'Tautan bertanda tangan (signed URL)',
        // Public endpoints: the token / signature / shared secret is the credential.
        'tamu/{token}' => 'Tautan tamu rapat: token = kredensial (publik by design)',
        'api/tamu/{token}/*' => 'API tamu rapat: token = kredensial (publik by design)',
        'api/hiring/form/{token}' => 'Webhook Google Form: token + tanda tangan HMAC',
        'internal/catatan/{note}/state' => 'Server kolaborasi: rahasia bersama (VerifyCollabSecret)',
        'internal/rapat/notulen/{minutes}/state' => 'Server kolaborasi: rahasia bersama (VerifyCollabSecret)',
        'kiosk/aktivasi/{token}' => 'Tautan aktivasi kiosk sekali pakai (token = kredensial)',
        'admin/karyawan/impor/{token}' => 'Token impor milik sesi pengunggah (tidak ada baris perusahaan)',
        'unggah/{upload}' => 'Unggahan sementara per sesi (tidak ada baris perusahaan)',
        // Parameters that are not company data (format, map tile, page slug, enum, own date).
        'admin/saldo-cuti/impor/templat/{format}' => 'Parameter format berkas (ListingLeakTest)',
        'admin/karyawan/impor/templat/{format}' => 'Parameter format berkas (ListingLeakTest)',
        'absensi/rekap/ekspor/{format}' => 'Parameter format berkas (ListingLeakTest)',
        'privasi/ekspor/{format}' => 'Parameter format berkas, data sendiri (ListingLeakTest)',
        'api/v1/peta/{z}/{x}/{y}' => 'Petak peta OpenStreetMap',
        'api/v1/absensi/hari/{date}' => 'Tanggal absensi milik sendiri',
        'pratinjau/panduan/*' => 'Panduan statis',
        'admin/dokumentasi/{slug}' => 'Dokumentasi statis',
        'peran/{role}*' => 'Parameter enum dashboard jabatan',
        'api/v1/peran/{role}*' => 'Parameter enum dashboard jabatan',
        'dashboard/{view}*' => 'Parameter enum tampilan dashboard',
        'api/v1/dashboard/{view}*' => 'Parameter enum tampilan dashboard',
    ];
}

/**
 * Failures found by this suite, waiting for Langkah 2 ("METHOD uri @role" => docs/sesi/fase1-celah.md row).
 *
 * @return array<string, string>
 */
function knownRouteGaps(): array
{
    return [];
}

/**
 * A redirect that reveals nothing: the login page, or the "not paired" page of
 * the kiosk routes (an employee browser is not a kiosk device).
 */
function routeLeakSafeRedirect(string $uri, string $location): bool
{
    $path = rtrim((string) parse_url($location, PHP_URL_PATH), '/');

    return $path === '/login' || (str_starts_with($uri, 'kiosk/{location}') && $path === '/kiosk');
}

function routeLeakExcluded(string $uri): ?string
{
    foreach (routeLeakExceptions() as $pattern => $reason) {
        if (fnmatch($pattern, $uri, FNM_NOESCAPE) || $pattern === $uri) {
            return $reason;
        }
    }

    return null;
}

/**
 * B values for the route's parameters, or null when none of them is company data.
 *
 * @return array<string, string>|null
 */
function routeLeakParameters(Route $route, object $world): ?array
{
    $types = [];

    foreach ($route->signatureParameters() as $parameter) {
        $type = $parameter->getType();
        $types[$parameter->getName()] = $type instanceof ReflectionNamedType ? $type->getName() : '';
    }

    $values = [];
    $owned = false;

    foreach ($route->parameterNames() as $name) {
        $type = $types[$name] ?? '';

        if ($type !== '' && is_subclass_of($type, UrlRoutable::class)) {
            $model = $world->models[$type] ?? null;

            // Project pages need the project workspace (the map holds the team one).
            if ($name === 'workspace' && preg_match('/proyek|ringkasan|portofolio/', $route->uri()) === 1) {
                $model = $world->projectWorkspace;
            }

            if ($model === null) {
                throw new RuntimeException("Tidak ada instans B untuk {$type} ({$route->uri()}); tambahkan ke foreignWorld().");
            }

            $values[$name] = (string) $model->getKey();
            $owned = true;
        } elseif ($type !== '' && enum_exists($type)) {
            $values[$name] = (string) $type::cases()[0]->value;
        } elseif (array_key_exists($name, $world->params)) {
            $values[$name] = $world->params[$name];
            $owned = true;
        } elseif ($name === 'type' && in_array('id', $route->parameterNames(), true)) {
            [$values['type'], $values['id']] = ['task', $world->task->id];
            $owned = true;
        } elseif ($name === 'id' && isset($values['id'])) {
            continue;
        } elseif ($name === 'number') {
            $values[$name] = (string) $world->task->number;
        } else {
            return null;
        }
    }

    return $owned ? $values : null;
}

/**
 * @param  array<string, string>  $values
 */
function routeLeakUri(Route $route, array $values): string
{
    $uri = preg_replace_callback('/\{(\w+)\??\}/', fn (array $match): string => $values[$match[1]] ?? '', $route->uri()) ?? '';

    return '/'.ltrim(rtrim($uri, '/'), '/');
}

beforeEach(function () {
    $this->withoutMiddleware([ThrottleRequests::class, ThrottleRequestsWithRedis::class]);

    config([
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'https://rapat.example.test',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => 'test-secret-that-is-at-least-32-characters',
        'notulen.transcriber.url' => 'https://notulen.example.test',
        'notulen.transcriber.secret' => str_repeat('a', 40),
        'notulen.transcriber.callback_secret' => str_repeat('b', 40),
    ]);
});

test('company A cannot read or change company B through any route parameter', function () {
    $home = homeWorld();
    $foreign = foreignWorld();

    Http::fake();
    Queue::fake();
    Mail::fake();
    Notification::fake();

    $ids = tenancyRowIds($foreign->company->id);
    $baseline = tenancyFingerprint($foreign->company->id, $ids);
    $actors = ['super_admin' => $home->superAdmin, 'hr' => $home->hr, 'direksi' => $home->direksi];
    $tested = [];
    $skipped = [];
    $failures = [];

    /** @var Route $route */
    foreach (app('router')->getRoutes() as $route) {
        if ($route->parameterNames() === []) {
            continue;
        }

        $uri = $route->uri();

        if (($reason = routeLeakExcluded($uri)) !== null) {
            $skipped[$uri] = $reason;

            continue;
        }

        $values = routeLeakParameters($route, $foreign);

        if ($values === null) {
            $skipped[$uri] = 'TANPA PARAMETER DATA PERUSAHAAN (belum dipetakan)';

            continue;
        }

        $path = routeLeakUri($route, $values);
        $api = str_starts_with($uri, 'api/');

        foreach (array_diff($route->methods(), ['HEAD', 'OPTIONS']) as $method) {
            $tested["{$method} {$uri}"] = true;

            foreach ($actors as $role => $actor) {
                app(AuthFactory::class)->forgetGuards();
                $actor = User::query()->findOrFail($actor->id);

                if ($api) {
                    Sanctum::actingAs($actor);
                    $response = $this->json($method, $path);
                } else {
                    $response = $this->actingAs($actor, 'web')->call($method, $path);
                }

                $status = $response->getStatusCode();
                $location = (string) $response->headers->get('Location');
                $problem = null;

                if ($method === 'GET') {
                    $allowed = in_array($status, [401, 403, 404, 410], true)
                        || (in_array($status, [302, 303], true) && routeLeakSafeRedirect($uri, $location));

                    if (! $allowed) {
                        $problem = "GET menjawab {$status}".($location !== '' ? " → {$location}" : '');
                    }
                } elseif ($status >= 200 && $status < 300) {
                    $problem = "{$method} menjawab {$status}";
                }

                $body = $response->baseResponse instanceof StreamedResponse ? '' : (string) $response->getContent();

                if (leaksForeign($body)) {
                    $problem = trim(($problem ?? '')." · isi respons memuat data B ({$status})", ' ·');
                }

                if ($status >= 500) {
                    $exception = $response->exception;
                    $problem = "galat server {$status}".($exception !== null ? ': '.class_basename($exception).' '.Str::limit($exception->getMessage(), 160) : '');
                }

                $after = tenancyFingerprint($foreign->company->id, $ids);

                if ($after !== $baseline) {
                    $changed = array_keys(array_diff_assoc($after, $baseline) + array_diff_assoc($baseline, $after));
                    $problem = trim(($problem ?? '').' · data B berubah: '.implode(', ', $changed), ' ·');
                    $baseline = $after;
                }

                if ($problem !== null) {
                    $failures["{$method} {$uri} @{$role}"] = $problem;
                }
            }
        }
    }

    // Positive control: company B's own Super Admin / HR do reach these URLs,
    // so the 403/404 above come from isolation, not from broken parameters.
    $reachable = 0;
    $unreachable = [];

    foreach (app('router')->getRoutes() as $route) {
        if (! in_array('GET', $route->methods(), true) || $route->parameterNames() === [] || routeLeakExcluded($route->uri()) !== null) {
            continue;
        }

        $values = routeLeakParameters($route, $foreign);

        if ($values === null) {
            continue;
        }

        foreach ([$foreign->superAdmin, $foreign->hr, $foreign->kadiv, $foreign->anggota] as $owner) {
            app(AuthFactory::class)->forgetGuards();
            $owner = User::query()->findOrFail($owner->id);

            if (str_starts_with($route->uri(), 'api/')) {
                Sanctum::actingAs($owner);
                $status = $this->getJson(routeLeakUri($route, $values))->getStatusCode();
            } else {
                $status = $this->actingAs($owner, 'web')->get(routeLeakUri($route, $values))->getStatusCode();
            }

            if ($status >= 200 && $status < 300) {
                $reachable++;

                continue 2;
            }
        }

        $unreachable[] = $route->uri().' ('.$status.')';
    }

    $known = knownRouteGaps();
    $unexpected = array_diff_key($failures, $known);
    $fixed = array_diff_key($known, $failures);

    tenancyReport(sprintf("\n[tenancy] rute diuji: %d · dikecualikan: %d · celah tercatat: %d · GET terjangkau pemilik B: %d\n", count($tested), count($skipped), count($known), $reachable));

    if (getenv('TENANCY_DEBUG')) {
        fwrite(STDERR, '[tenancy] tak terjangkau pemilik B: '.implode(', ', $unreachable)."\n");
    }

    foreach ($unexpected as $key => $problem) {
        tenancyReport("[tenancy] {$key}: {$problem}\n");
    }

    expect(array_filter($skipped, fn (string $reason): bool => str_starts_with($reason, 'TANPA')))->toBe([], 'Rute ber-parameter yang belum dipetakan')
        ->and($unexpected)->toBe([], 'Kebocoran baru (catat di docs/sesi/fase1-celah.md + knownRouteGaps() atau perbaiki)')
        ->and($fixed)->toBe([], 'Celah tercatat sudah tertutup: hapus dari knownRouteGaps()')
        ->and(count($tested))->toBeGreaterThanOrEqual(300)
        ->and($reachable)->toBeGreaterThanOrEqual(100, 'Kontrol positif: pemilik B harus bisa membuka sebagian besar URL ini');
});
