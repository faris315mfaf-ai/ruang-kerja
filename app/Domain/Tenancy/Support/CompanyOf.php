<?php

namespace App\Domain\Tenancy\Support;

use App\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use ReflectionObject;

/**
 * Finds the company a value belongs to: a Company, a model with a loaded
 * `company_id`, or the first such model in a collection/array. Used to
 * capture the company of queued jobs created outside a CompanyContext.
 */
final class CompanyOf
{
    public static function value(mixed $value, int $depth = 0): ?string
    {
        if ($value instanceof Company) {
            return $value->id;
        }

        if ($value instanceof Model) {
            $id = $value->getAttributes()['company_id'] ?? null;

            return is_string($id) && $id !== '' ? $id : null;
        }

        if ($depth > 0) {
            return null;
        }

        if ($value instanceof Collection) {
            $value = $value->all();
        }

        if (is_array($value)) {
            foreach ($value as $item) {
                $id = self::value($item, $depth + 1);

                if ($id !== null) {
                    return $id;
                }
            }
        }

        return null;
    }

    /**
     * The first property (declaration order) of $object that resolves to a company.
     */
    public static function properties(object $object): ?string
    {
        foreach ((new ReflectionObject($object))->getProperties() as $property) {
            if ($property->isStatic() || ! $property->isInitialized($object)) {
                continue;
            }

            $id = self::value($property->getValue($object));

            if ($id !== null) {
                return $id;
            }
        }

        return null;
    }
}
