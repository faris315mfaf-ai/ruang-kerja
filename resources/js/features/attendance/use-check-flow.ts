import { http, router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from '@/hooks/use-camera';
import { useGeolocation } from '@/hooks/use-geolocation';
import { deviceId } from '@/lib/device';
import { nearestLocation } from '@/lib/geo';
import { checkIn, checkOut } from '@/routes/attendance';
import checkInRoutes from '@/routes/attendance/check-in';
import checkOutRoutes from '@/routes/attendance/check-out';
import consentRoutes from '@/routes/attendance/consent';
import { captureVideoFrame, compressFile } from '@/lib/image';
import { isWindowRejection } from './windows';
import {
    POINTS_COPY,
    pointsKindFor,
    pointsServerError,
    submitProblems,
    workPoints,
} from './work-points';
import type { CheckType, PointsKind } from './work-points';
import type {
    AttendanceConsentState,
    CheckMethod,
    CheckRejection,
    CheckResult,
    TodayAttendance,
} from '@/types/attendance';

export type { CheckType };

export type CheckStep =
    | 'idle'
    | 'consent'
    | 'capture'
    | 'review'
    | 'scan'
    | 'submitting'
    | 'success'
    | 'failure';

export type CapturedPhoto = { blob: Blob; url: string };

const ENDPOINTS: Record<CheckType, () => string> = {
    in: () => checkIn.url(),
    out: () => checkOut.url(),
};

const QR_ENDPOINTS: Record<CheckType, () => string> = {
    in: () => checkInRoutes.qr.url(),
    out: () => checkOutRoutes.qr.url(),
};

/** How long a QR submit waits for a first GPS fix (GPS is optional for QR). */
export const QR_GPS_WAIT_MS = 4_000;

/** Props refreshed after a successful check-in/out. */
const RELOAD_ONLY = ['today', 'history', 'attendanceStatus'];

type ErrorBody = {
    message?: string;
    reason?: CheckRejection['reason'];
    context?: CheckRejection['context'];
    errors?: Record<string, string[]>;
};

function parseBody(raw: string): ErrorBody {
    try {
        return JSON.parse(raw) as ErrorBody;
    } catch {
        return {};
    }
}

/** Maps an HTTP failure to what the failure screen shows. */
export function toRejection(status: number | null, raw = ''): CheckRejection {
    if (status === null) {
        return {
            reason: 'network',
            message:
                'Koneksi terputus. Check-in butuh koneksi internet, coba lagi.',
            context: {},
        };
    }

    if (status === 429) {
        return {
            reason: 'rate_limited',
            message:
                'Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.',
            context: {},
        };
    }

    if (status === 419) {
        return {
            reason: 'server',
            message:
                'Sesi Anda kedaluwarsa. Muat ulang halaman lalu coba lagi.',
            context: {},
        };
    }

    const body = parseBody(raw);

    if (status === 422 && body.reason) {
        return {
            reason: body.reason,
            message: body.message ?? '',
            context: body.context ?? {},
        };
    }

    if (status === 422 && body.errors) {
        const first = Object.values(body.errors)[0]?.[0];
        const errors = Object.fromEntries(
            Object.entries(body.errors)
                .filter(([, messages]) => messages.length > 0)
                .map(([field, messages]) => [field, messages[0]]),
        );

        return {
            reason: 'validation',
            message: first ?? body.message ?? 'Data tidak valid.',
            errors,
            context: {},
        };
    }

    if (status === 401) {
        return {
            reason: 'server',
            message: 'Anda perlu masuk lagi.',
            context: {},
        };
    }

    return {
        reason: 'server',
        message: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.',
        context: {},
    };
}

/** Inertia's HTTP client throws HttpResponseError (with `response`) or HttpNetworkError. */
export function rejectionFromError(error: unknown): CheckRejection {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = (
            error as { response: { status: number; data: unknown } }
        ).response;

        return toRejection(
            response.status,
            typeof response.data === 'string' ? response.data : '',
        );
    }

    if (error instanceof Error && error.name === 'HttpNetworkError') {
        return toRejection(null);
    }

    return error instanceof Error && /network/i.test(error.message)
        ? toRejection(null)
        : toRejection(500);
}

/**
 * Shared check-in/out state machine for the mobile screens and the desktop
 * dialog (docs/PLATFORM.md §5 rule 2): consent → selfie → review → submit →
 * success/failure. Location is read in parallel with the camera.
 */
export function useCheckFlow(
    today: TodayAttendance,
    consent: AttendanceConsentState,
) {
    const geo = useGeolocation();
    const camera = useCamera();
    const [step, setStep] = useState<CheckStep>('idle');
    const [type, setType] = useState<CheckType>('in');
    const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
    const [note, setNote] = useState('');
    const [noteError, setNoteError] = useState<string | null>(null);
    // One draft per kind: the morning plan must not leak into the evening report.
    const [drafts, setDrafts] = useState<Record<PointsKind, string[]>>({
        plan: [''],
        report: [''],
    });
    const [pointsError, setPointsError] = useState<string | null>(null);
    const pointsKind = pointsKindFor(type);
    const points = drafts[pointsKind];
    const setPoints = useCallback(
        (next: string[]) =>
            setDrafts((current) => ({ ...current, [pointsKind]: next })),
        [pointsKind],
    );
    const [result, setResult] = useState<CheckResult | null>(null);
    const [rejection, setRejection] = useState<CheckRejection | null>(null);
    const [progress, setProgress] = useState(0);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [consenting, setConsenting] = useState(false);
    const [method, setMethodState] = useState<CheckMethod>('gps');
    const methodRef = useRef<CheckMethod>('gps');
    const photoRef = useRef<CapturedPhoto | null>(null);

    const setMethod = useCallback((next: CheckMethod) => {
        methodRef.current = next;
        setMethodState(next);
    }, []);

    const match = useMemo(
        () =>
            geo.position
                ? nearestLocation(today.locations, geo.position)
                : null,
        [geo.position, today.locations],
    );

    const isRemote =
        today.schedule.allowsRemote && (match === null || !match.inside);

    const replacePhoto = useCallback((next: CapturedPhoto | null) => {
        if (photoRef.current) {
            URL.revokeObjectURL(photoRef.current.url);
        }

        photoRef.current = next;
        setPhoto(next);
    }, []);

    useEffect(() => () => replacePhoto(null), [replacePhoto]);

    const beginCapture = useCallback(() => {
        setStep('capture');
        setCaptureError(null);
        void geo.request();
        void camera.start('user');
    }, [camera, geo]);

    /** QR: rear camera; location is read in parallel and sent when allowed. */
    const beginScan = useCallback(() => {
        setStep('scan');
        setCaptureError(null);
        void geo.request();
        void camera.start('environment');
    }, [camera, geo]);

    const beginMethod = useCallback(() => {
        if (methodRef.current === 'qr') {
            beginScan();

            return;
        }

        beginCapture();
    }, [beginCapture, beginScan]);

    const start = useCallback(
        (next: CheckType, nextMethod?: CheckMethod) => {
            if (nextMethod) {
                setMethod(nextMethod);
            }

            setType(next);
            setResult(null);
            setRejection(null);
            setNote('');
            setNoteError(null);
            setPointsError(null);
            replacePhoto(null);

            if (!consent.granted) {
                setStep('consent');

                return;
            }

            beginMethod();
        },
        [beginMethod, consent.granted, replacePhoto, setMethod],
    );

    const acceptConsent = useCallback(() => {
        setConsenting(true);
        router.post(
            consentRoutes.store(),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                only: ['consent'],
                onSuccess: () => beginMethod(),
                onFinish: () => setConsenting(false),
            },
        );
    }, [beginMethod]);

    const capture = useCallback(async () => {
        const video = camera.videoRef.current;

        if (!video) {
            return;
        }

        try {
            const blob = await captureVideoFrame(video);
            replacePhoto({ blob, url: URL.createObjectURL(blob) });
            camera.stop();
            setStep('review');
        } catch (error) {
            setCaptureError(
                error instanceof Error ? error.message : 'Foto gagal diambil.',
            );
        }
    }, [camera, replacePhoto]);

    const captureFile = useCallback(
        async (file: File) => {
            try {
                const blob = await compressFile(file);
                replacePhoto({ blob, url: URL.createObjectURL(blob) });
                camera.stop();
                setStep('review');
            } catch {
                setCaptureError('Foto tidak bisa dibaca. Coba ambil ulang.');
            }
        },
        [camera, replacePhoto],
    );

    const retake = useCallback(() => {
        replacePhoto(null);
        beginCapture();
    }, [beginCapture, replacePhoto]);

    const submit = useCallback(async () => {
        if (!photo) {
            return;
        }

        const problems = submitProblems({ type, points, isRemote, note });

        setPointsError(problems.points);
        setNoteError(problems.note);

        if (problems.points || problems.note) {
            return;
        }

        setStep('submitting');
        setProgress(0);

        const position = geo.position ?? (await geo.request());

        if (!position) {
            setRejection({
                reason: 'validation',
                message:
                    'Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.',
                context: {},
            });
            setStep('failure');

            return;
        }

        const form = new FormData();
        form.append('latitude', String(position.latitude));
        form.append('longitude', String(position.longitude));
        form.append(
            'accuracy',
            String(Math.round(position.accuracy * 100) / 100),
        );
        form.append('client_time', new Date().toISOString());
        form.append('device_id', deviceId());
        form.append('selfie', photo.blob, 'selfie.jpg');

        if (note.trim() !== '') {
            form.append('note', note.trim());
        }

        // Check-in sends the plan, check-out the report (`work_plan` /
        // `work_report`, docs/sesi/ponsel-b5-absensi-laporan-jendela.md §A).
        for (const point of workPoints(points)) {
            form.append(`${POINTS_COPY[pointsKind].field}[]`, point);
        }

        try {
            const response = await http.getClient().request({
                method: 'post',
                url: ENDPOINTS[type](),
                data: form,
                headers: { Accept: 'application/json' },
                onUploadProgress: (event) => setProgress(event.percentage ?? 0),
            });

            const body = JSON.parse(response.data) as { result: CheckResult };
            setResult(body.result);
            setStep('success');
            setDrafts((current) => ({ ...current, [pointsKind]: [''] }));
            router.reload({ only: RELOAD_ONLY });
        } catch (error) {
            const next = rejectionFromError(error);
            const serverPointsError = pointsServerError(next, type);

            if (serverPointsError) {
                setPointsError(serverPointsError);
                setStep('review');

                return;
            }

            if (next.reason === 'note_required') {
                setNoteError(next.message);
                setStep('review');

                return;
            }

            if (next.reason === 'consent_required') {
                setStep('consent');

                return;
            }

            if (isWindowRejection(next.reason)) {
                // The page's action must now read "ditutup/belum dibuka".
                router.reload({ only: RELOAD_ONLY });
            }

            setRejection(next);
            setStep('failure');
        }
    }, [geo, isRemote, note, photo, points, pointsKind, type]);

    /** A kiosk code was read: send it with the GPS position when available. */
    const submitQr = useCallback(
        async (payload: string) => {
            camera.stop();
            setStep('submitting');
            setProgress(0);

            const position =
                geo.position ??
                (await Promise.race([
                    geo.request(),
                    new Promise<null>((resolve) =>
                        window.setTimeout(() => resolve(null), QR_GPS_WAIT_MS),
                    ),
                ]));

            const form = new FormData();
            form.append('payload', payload);
            form.append('client_time', new Date().toISOString());
            form.append('device_id', deviceId());

            if (position) {
                form.append('latitude', String(position.latitude));
                form.append('longitude', String(position.longitude));
                form.append(
                    'accuracy',
                    String(Math.round(position.accuracy * 100) / 100),
                );
            }

            try {
                const response = await http.getClient().request({
                    method: 'post',
                    url: QR_ENDPOINTS[type](),
                    data: form,
                    headers: { Accept: 'application/json' },
                });

                const body = JSON.parse(response.data) as {
                    result: CheckResult;
                };
                setResult(body.result);
                setStep('success');
                router.reload({ only: RELOAD_ONLY });
            } catch (error) {
                const next = rejectionFromError(error);

                if (next.reason === 'consent_required') {
                    setStep('consent');

                    return;
                }

                if (isWindowRejection(next.reason)) {
                    router.reload({ only: RELOAD_ONLY });
                }

                setRejection(next);
                setStep('failure');
            }
        },
        [camera, geo, type],
    );

    /** "Perbarui lokasi": read the position again and resend the same selfie. */
    const retryWithFreshLocation = useCallback(async () => {
        setStep('submitting');
        const fresh = await geo.request();

        if (!fresh) {
            setStep('failure');

            return;
        }

        setStep('review');
    }, [geo]);

    const close = useCallback(() => {
        camera.stop();
        replacePhoto(null);
        setStep('idle');
    }, [camera, replacePhoto]);

    return {
        step,
        type,
        method,
        setMethod,
        beginScan,
        submitQr,
        photo,
        note,
        setNote,
        noteError,
        pointsKind,
        points,
        setPoints,
        pointsError,
        result,
        rejection,
        progress,
        consenting,
        captureError,
        geo,
        camera,
        match,
        isRemote,
        start,
        acceptConsent,
        capture,
        captureFile,
        retake,
        submit,
        retryWithFreshLocation,
        close,
    };
}

export type CheckFlow = ReturnType<typeof useCheckFlow>;
