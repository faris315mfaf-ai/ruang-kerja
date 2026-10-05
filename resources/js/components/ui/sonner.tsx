import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { appearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position="bottom-right"
            containerAriaLabel="Notifikasi"
            offset={{ bottom: 'var(--toast-offset-bottom, 24px)' }}
            mobileOffset={{
                bottom: 'var(--toast-offset-bottom, 16px)',
            }}
            toastOptions={{ closeButtonAriaLabel: 'Tutup notifikasi' }}
            // Inverse toast of the design (Komponen: dark chip on light, light
            // chip at night); details in app.css "Toasts".
            style={
                {
                    '--normal-bg': 'var(--inverse)',
                    '--normal-text': 'var(--on-inverse)',
                    '--normal-border': 'transparent',
                    '--border-radius': '18px',
                    '--width': '380px',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
