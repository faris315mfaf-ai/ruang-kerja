import { Head, Link } from '@inertiajs/react';
import { LayoutGrid } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate } from '@/lib/format';
import { dashboard } from '@/routes';
import { edit } from '@/routes/profile';

function DashboardEmptyState() {
    return (
        <EmptyState
            icon={LayoutGrid}
            title="Belum ada data untuk ditampilkan"
            description="Ringkasan kehadiran, tugas, dan persetujuan akan muncul di sini setelah absensi dan workspace mulai dipakai."
            action={
                <Button asChild variant="outline" size="sm">
                    <Link href={edit()} prefetch>
                        Lengkapi profil
                    </Link>
                </Button>
            }
        />
    );
}

export default function Dashboard() {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Dashboard" />
            {breakpoint === 'mobile' ? (
                <div className="space-y-4">
                    <DashboardEmptyState />
                </div>
            ) : (
                <div className="space-y-6">
                    <header>
                        <h1 className="text-xl leading-7 font-semibold text-text">
                            Dashboard
                        </h1>
                        <p className="text-sm text-text-muted">
                            {formatDate(new Date())}
                        </p>
                    </header>
                    <DashboardEmptyState />
                </div>
            )}
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
    appBar: 'greeting',
};
