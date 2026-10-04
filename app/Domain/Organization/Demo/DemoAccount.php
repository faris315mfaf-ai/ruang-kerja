<?php

namespace App\Domain\Organization\Demo;

use App\Domain\Organization\Enums\Role;

final readonly class DemoAccount
{
    public function __construct(
        public string $email,
        public string $name,
        public Role $role,
    ) {}

    /**
     * Shape shared with the login page (`demoAccounts` prop).
     *
     * @return array{email: string, name: string, role_label: string}
     */
    public function toProps(): array
    {
        return [
            'email' => $this->email,
            'name' => $this->name,
            'role_label' => $this->role->label(),
        ];
    }
}
