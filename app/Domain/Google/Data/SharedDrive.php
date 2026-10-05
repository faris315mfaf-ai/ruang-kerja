<?php

namespace App\Domain\Google\Data;

final readonly class SharedDrive
{
    public function __construct(
        public string $id,
        public string $name,
    ) {}
}
