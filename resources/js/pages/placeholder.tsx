import { Head, Link } from '@inertiajs/react';
import { Hammer } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

type Props = {
    title: string;
    description?: string;
};

/** Menu entries whose module arrives in a later sprint. */
export default function Placeholder({ title, description }: Props) {
    return (
        <>
            <Head title={title} />
            <div className="space-y-6">
                <header className="hidden md:block">
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        {title}
                    </h1>
                </header>
                <EmptyState
                    icon={Hammer}
                    title="Fitur ini sedang disiapkan"
                    description={
                        description ??
                        `${title} akan tersedia pada pembaruan berikutnya.`
                    }
                    action={
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard" prefetch>
                                Kembali ke Dashboard
                            </Link>
                        </Button>
                    }
                />
            </div>
        </>
    );
}
