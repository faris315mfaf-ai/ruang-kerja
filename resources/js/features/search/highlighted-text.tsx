import { highlightMatches } from '@/features/search/highlight';

export function HighlightedText({
    text,
    query,
}: {
    text: string;
    query: string;
}) {
    return (
        <>
            {highlightMatches(text, query).map((segment, index) =>
                segment.match ? (
                    <strong key={index} className="font-bold text-link">
                        {segment.text}
                    </strong>
                ) : (
                    <span key={index}>{segment.text}</span>
                ),
            )}
        </>
    );
}
