<?php

namespace App\Domain\Requests\Data;

use App\Models\LeaveType;
use Illuminate\Http\UploadedFile;

/**
 * Validated form input of a request (any category). Fields not used by the
 * category are ignored.
 */
final readonly class RequestInput
{
    /**
     * @param  list<UploadedFile>  $attachments  new files
     * @param  list<string>  $removeAttachments  ids of existing attachments to drop
     */
    public function __construct(
        public LeaveType $leaveType,
        public string $reason,
        public ?string $startDate = null,
        public ?string $endDate = null,
        public bool $halfDay = false,
        public ?string $date = null,
        public ?string $startTime = null,
        public ?string $endTime = null,
        public ?string $checkIn = null,
        public ?string $checkOut = null,
        public ?string $destination = null,
        public ?string $substituteId = null,
        public array $attachments = [],
        public array $removeAttachments = [],
        // Pengajuan barang (procurement).
        public ?string $itemName = null,
        public ?int $quantity = null,
        public ?string $unit = null,
        public ?int $unitPrice = null,
        public ?string $referenceUrl = null,
        public ?string $urgency = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated request data
     */
    public static function fromArray(LeaveType $leaveType, array $data): self
    {
        $string = fn (string $key): ?string => isset($data[$key]) && is_scalar($data[$key]) && (string) $data[$key] !== ''
            ? (string) $data[$key]
            : null;

        $files = array_values(array_filter(
            is_array($data['attachments'] ?? null) ? $data['attachments'] : [],
            fn (mixed $file): bool => $file instanceof UploadedFile,
        ));

        $remove = array_values(array_filter(
            is_array($data['remove_attachments'] ?? null) ? $data['remove_attachments'] : [],
            fn (mixed $id): bool => is_string($id) && $id !== '',
        ));

        return new self(
            leaveType: $leaveType,
            reason: trim($string('reason') ?? ''),
            startDate: $string('start_date'),
            endDate: $string('end_date'),
            halfDay: filter_var($data['half_day'] ?? false, FILTER_VALIDATE_BOOL),
            date: $string('date'),
            startTime: $string('start_time'),
            endTime: $string('end_time'),
            checkIn: $string('check_in'),
            checkOut: $string('check_out'),
            destination: $string('destination'),
            substituteId: $string('substitute_id'),
            attachments: $files,
            removeAttachments: $remove,
            itemName: $string('item_name'),
            quantity: self::integer($data['quantity'] ?? null),
            unit: $string('unit'),
            unitPrice: self::integer($data['unit_price'] ?? null),
            referenceUrl: $string('reference_url'),
            urgency: $string('urgency'),
        );
    }

    private static function integer(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        return is_string($value) && preg_match('/^-?\d{1,15}$/', trim($value)) === 1 ? (int) trim($value) : null;
    }
}
