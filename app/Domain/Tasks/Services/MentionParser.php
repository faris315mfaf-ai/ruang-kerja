<?php

namespace App\Domain\Tasks\Services;

/**
 * Extracts the ids of `mention` (@person) and `taskReference` (#KEY-n) nodes
 * from a Tiptap document (docs/ARCHITECTURE.md §3.5). Order of first
 * appearance, without duplicates.
 */
final class MentionParser
{
    /**
     * @param  array<mixed>|null  $document
     * @return list<string>
     */
    public function userIds(?array $document): array
    {
        return $this->ids($document, 'mention');
    }

    /**
     * @param  array<mixed>|null  $document
     * @return list<string>
     */
    public function taskIds(?array $document): array
    {
        return $this->ids($document, 'taskReference');
    }

    /**
     * @param  array<mixed>|null  $document
     * @return list<string>
     */
    private function ids(?array $document, string $type): array
    {
        if ($document === null) {
            return [];
        }

        $ids = [];
        $this->collect($document, $type, $ids, 0);

        return array_keys($ids);
    }

    /**
     * @param  array<mixed>  $node
     * @param  array<string, true>  $ids
     */
    private function collect(array $node, string $type, array &$ids, int $depth): void
    {
        if ($depth > RichText::MAX_DEPTH + 2) {
            return;
        }

        if (($node['type'] ?? null) === $type) {
            $attrs = $node['attrs'] ?? null;
            $id = is_array($attrs) ? ($attrs['id'] ?? null) : null;

            // ULIDs only (26 chars, Crockford base32); anything else is ignored.
            if (is_string($id) && preg_match('/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/', $id) === 1) {
                $ids[strtolower($id)] = true;
            }
        }

        foreach (is_array($node['content'] ?? null) ? $node['content'] : [] as $child) {
            if (is_array($child)) {
                $this->collect($child, $type, $ids, $depth + 1);
            }
        }
    }
}
