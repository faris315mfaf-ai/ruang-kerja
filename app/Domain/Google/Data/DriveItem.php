<?php

namespace App\Domain\Google\Data;

use App\Domain\Google\Enums\DriveFileKind;
use Carbon\CarbonImmutable;

/**
 * Metadata of one Drive file or folder (subset of the Drive v3 File resource).
 */
final readonly class DriveItem
{
    /**
     * Fields requested from Drive for every file call.
     */
    public const string FIELDS = 'id,name,mimeType,webViewLink,iconLink,thumbnailLink,size,owners(emailAddress),lastModifyingUser(emailAddress),modifiedTime,parents,appProperties,trashed,driveId';

    /**
     * @param  list<string>  $parents
     * @param  array<string, string>  $appProperties
     */
    public function __construct(
        public string $id,
        public string $name,
        public string $mimeType,
        public ?string $webViewLink = null,
        public ?string $iconLink = null,
        public ?string $thumbnailLink = null,
        public ?int $size = null,
        public ?string $ownerEmail = null,
        public ?CarbonImmutable $modifiedAt = null,
        public array $parents = [],
        public array $appProperties = [],
        public bool $trashed = false,
        public ?string $driveId = null,
    ) {}

    /**
     * @param  array<array-key, mixed>  $data  Drive v3 File resource
     */
    public static function fromApi(array $data): self
    {
        $owners = is_array($data['owners'] ?? null) ? $data['owners'] : [];
        $firstOwner = $owners[0] ?? null;
        $lastModifier = is_array($data['lastModifyingUser'] ?? null) ? $data['lastModifyingUser'] : [];

        $ownerEmail = is_array($firstOwner) && is_string($firstOwner['emailAddress'] ?? null)
            ? $firstOwner['emailAddress']
            : (is_string($lastModifier['emailAddress'] ?? null) ? $lastModifier['emailAddress'] : null);

        $parents = is_array($data['parents'] ?? null)
            ? array_values(array_filter($data['parents'], 'is_string'))
            : [];

        $appProperties = [];

        foreach (is_array($data['appProperties'] ?? null) ? $data['appProperties'] : [] as $key => $value) {
            if (is_string($key) && is_scalar($value)) {
                $appProperties[$key] = (string) $value;
            }
        }

        return new self(
            id: self::string($data, 'id') ?? '',
            name: self::string($data, 'name') ?? '',
            mimeType: self::string($data, 'mimeType') ?? 'application/octet-stream',
            webViewLink: self::string($data, 'webViewLink'),
            iconLink: self::string($data, 'iconLink'),
            thumbnailLink: self::string($data, 'thumbnailLink'),
            size: is_numeric($data['size'] ?? null) ? (int) $data['size'] : null,
            ownerEmail: $ownerEmail,
            modifiedAt: is_string($data['modifiedTime'] ?? null) ? CarbonImmutable::parse($data['modifiedTime']) : null,
            parents: $parents,
            appProperties: $appProperties,
            trashed: (bool) ($data['trashed'] ?? false),
            driveId: self::string($data, 'driveId'),
        );
    }

    /**
     * Inverse of fromApi() (used by FakeDriveClient).
     *
     * @return array<string, mixed>
     */
    public function toApi(): array
    {
        return array_filter([
            'id' => $this->id,
            'name' => $this->name,
            'mimeType' => $this->mimeType,
            'webViewLink' => $this->webViewLink,
            'iconLink' => $this->iconLink,
            'thumbnailLink' => $this->thumbnailLink,
            'size' => $this->size === null ? null : (string) $this->size,
            'owners' => $this->ownerEmail === null ? null : [['emailAddress' => $this->ownerEmail]],
            'modifiedTime' => $this->modifiedAt?->toIso8601ZuluString(),
            'parents' => $this->parents,
            'appProperties' => $this->appProperties,
            'trashed' => $this->trashed,
            'driveId' => $this->driveId,
        ], static fn (mixed $value): bool => $value !== null);
    }

    public function kind(): DriveFileKind
    {
        return DriveFileKind::fromMimeType($this->mimeType);
    }

    public function isFolder(): bool
    {
        return $this->mimeType === DriveFileKind::FOLDER_MIME;
    }

    /**
     * @param  array<array-key, mixed>  $data
     */
    private static function string(array $data, string $key): ?string
    {
        return is_string($data[$key] ?? null) ? $data[$key] : null;
    }
}
