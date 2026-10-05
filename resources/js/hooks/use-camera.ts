import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState =
    | 'idle'
    | 'starting'
    | 'live'
    | 'denied'
    | 'unavailable'
    | 'unsupported';

export type FacingMode = 'user' | 'environment';

export const CAMERA_MESSAGES: Record<
    'denied' | 'unavailable' | 'unsupported',
    string
> = {
    denied: 'Akses kamera ditolak. Izinkan kamera untuk situs ini, atau ambil foto lewat tombol di bawah.',
    unavailable:
        'Kamera tidak bisa dibuka. Tutup aplikasi lain yang memakai kamera lalu coba lagi.',
    unsupported:
        'Browser ini tidak mendukung kamera langsung. Ambil foto lewat tombol di bawah.',
};

/**
 * Front camera stream for the selfie (getUserMedia). The stream is stopped
 * when the screen closes, so the camera is only on while taking the selfie.
 */
export function useCamera() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [state, setState] = useState<CameraState>('idle');
    const [facing, setFacing] = useState<FacingMode>('user');

    const stop = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setState('idle');
    }, []);

    const start = useCallback(async (mode: FacingMode = 'user') => {
        if (
            typeof navigator === 'undefined' ||
            !navigator.mediaDevices?.getUserMedia
        ) {
            setState('unsupported');

            return;
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        setFacing(mode);
        setState('starting');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: mode,
                    width: { ideal: 960 },
                    height: { ideal: 1280 },
                },
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => undefined);
            }

            setState('live');
        } catch (error) {
            const name = error instanceof DOMException ? error.name : '';
            setState(
                name === 'NotAllowedError' || name === 'SecurityError'
                    ? 'denied'
                    : 'unavailable',
            );
        }
    }, []);

    /** Callback ref for the <video>: attaches the stream whenever the element mounts. */
    const attachVideo = useCallback((element: HTMLVideoElement | null) => {
        videoRef.current = element;

        if (
            element &&
            streamRef.current &&
            element.srcObject !== streamRef.current
        ) {
            element.srcObject = streamRef.current;
            void element.play().catch(() => undefined);
        }
    }, []);

    const switchCamera = useCallback(() => {
        void start(facing === 'user' ? 'environment' : 'user');
    }, [facing, start]);

    useEffect(() => stop, [stop]);

    const error =
        state === 'denied' || state === 'unavailable' || state === 'unsupported'
            ? CAMERA_MESSAGES[state]
            : null;

    return {
        videoRef,
        attachVideo,
        state,
        facing,
        error,
        start,
        stop,
        switchCamera,
    };
}
