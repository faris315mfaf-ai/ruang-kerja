<?php

use App\Domain\Notifications\Digest\DigestBuilder;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Tests\Support\RequestScenario;

/*
 * The daily digest lists approvals waiting for the user once — in the richer
 * "Menunggu persetujuan Anda" section — and not again under "Perlu tindakan
 * di Inbox"; other action-required items stay in the Inbox section.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 07:30', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

it('lists a pending approval only in the approvals section', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    // The approver also has the "request.submitted" Inbox item that needs action.
    expect(InboxNotification::query()->where('notifiable_id', $s->manager->id)->where('type', NotificationType::RequestSubmitted->value)->needsAction()->exists())->toBeTrue();

    $digest = app(DigestBuilder::class)->build($s->manager, CarbonImmutable::parse('2026-10-05', 'Asia/Jakarta'))->toArray();

    expect(array_column($digest['sections'], 'key'))->toBe(['requests.pending_approval'])
        ->and($digest['sections'][0]['count'])->toBe(1)
        ->and($digest['sections'][0]['items'][0])->toMatchArray(['title' => $s->employee->name, 'code' => $request->number, 'badge' => 'Cuti tahunan']);
});

it('keeps other action-required items (revision requests) in the Inbox section', function () {
    $s = $this->s;
    InboxNotification::factory()->recipient($s->manager)->ofType(NotificationType::RequestRevisionRequested)->withData(['title' => 'Revisi pengajuan lembur'])->create();
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    $digest = app(DigestBuilder::class)->build($s->manager, CarbonImmutable::parse('2026-10-05', 'Asia/Jakarta'))->toArray();

    expect(array_column($digest['sections'], 'key'))->toBe(['requests.pending_approval', 'inbox.action'])
        ->and($digest['sections'][1]['count'])->toBe(1)
        ->and($digest['sections'][1]['items'][0]['title'])->toBe('Revisi pengajuan lembur');
});
