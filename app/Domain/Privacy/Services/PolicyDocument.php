<?php

namespace App\Domain\Privacy\Services;

/**
 * The privacy policy as structured JSON for the mobile app: the same
 * Markdown the web renders (placeholders filled, editor comments removed),
 * split at the `## ` headings. Raw HTML tags are removed so the app only has
 * to render Markdown.
 */
final class PolicyDocument
{
    public function __construct(private readonly PrivacyPolicy $policy) {}

    /**
     * @return array{title: string, version: string, effective_date: string, sections: list<array{title: string, body_markdown: string}>}
     */
    public function toArray(): array
    {
        $markdown = (string) preg_replace('/<\/?[a-z][^>]*>/i', '', $this->policy->markdown());
        $parts = preg_split('/^##[ \t]+(.+)$/m', $markdown, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [];

        $sections = [];
        $intro = trim($parts[0] ?? '');

        if ($intro !== '') {
            $sections[] = ['title' => 'Pendahuluan', 'body_markdown' => $intro];
        }

        for ($i = 1, $count = count($parts); $i < $count; $i += 2) {
            $sections[] = [
                'title' => trim($parts[$i]),
                'body_markdown' => trim($parts[$i + 1] ?? ''),
            ];
        }

        return [
            'title' => 'Kebijakan Privasi',
            'version' => $this->policy->version(),
            'effective_date' => $this->policy->effectiveDate(),
            'sections' => $sections,
        ];
    }
}
