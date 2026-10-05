<?php

namespace App\Domain\Google\Data;

use App\Domain\Google\Enums\DriveRole;

/**
 * One permission on a Drive file/folder. For Shared Drive items Drive reports
 * whether access is inherited (Shared Drive membership) and/or direct.
 */
final readonly class DrivePermission
{
    public const string FIELDS = 'nextPageToken,permissions(id,type,role,emailAddress,permissionDetails(inherited,role,permissionType))';

    public function __construct(
        public string $id,
        public string $type,
        public string $role,
        public ?string $emailAddress = null,
        public bool $inherited = false,
        public bool $direct = true,
    ) {}

    /**
     * @param  array<array-key, mixed>  $data  Drive v3 Permission resource
     */
    public static function fromApi(array $data): self
    {
        $details = is_array($data['permissionDetails'] ?? null) ? $data['permissionDetails'] : [];
        $inherited = false;
        $direct = $details === [];

        foreach ($details as $detail) {
            if (! is_array($detail)) {
                continue;
            }

            if ((bool) ($detail['inherited'] ?? false)) {
                $inherited = true;
            } else {
                $direct = true;
            }
        }

        return new self(
            id: is_string($data['id'] ?? null) ? $data['id'] : '',
            type: is_string($data['type'] ?? null) ? $data['type'] : 'user',
            role: is_string($data['role'] ?? null) ? $data['role'] : 'reader',
            emailAddress: is_string($data['emailAddress'] ?? null) ? $data['emailAddress'] : null,
            inherited: $inherited,
            direct: $direct,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toApi(): array
    {
        $details = [];

        if ($this->inherited) {
            $details[] = ['inherited' => true, 'role' => $this->role, 'permissionType' => 'member'];
        }

        if ($this->direct && $this->inherited) {
            $details[] = ['inherited' => false, 'role' => $this->role, 'permissionType' => 'file'];
        }

        return array_filter([
            'id' => $this->id,
            'type' => $this->type,
            'role' => $this->role,
            'emailAddress' => $this->emailAddress,
            'permissionDetails' => $details === [] ? null : $details,
        ], static fn (mixed $value): bool => $value !== null);
    }

    public function email(): ?string
    {
        return $this->emailAddress === null ? null : strtolower($this->emailAddress);
    }

    public function driveRole(): ?DriveRole
    {
        return DriveRole::fromDrive($this->role);
    }

    /**
     * Only direct, user-type permissions are managed by the sync.
     */
    public function isManagedUser(): bool
    {
        return $this->type === 'user' && $this->direct && ! $this->inherited && $this->email() !== null;
    }
}
