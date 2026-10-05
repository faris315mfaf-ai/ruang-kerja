<?php

namespace App\Domain\Attendance\Enums;

/**
 * Why a check-in/out was refused. Sent to the client so it can pick the right
 * screen (consent, outside-radius map, …).
 */
enum AttendanceRejection: string
{
    case ConsentRequired = 'consent_required';
    case AlreadyCheckedIn = 'already_checked_in';
    case AlreadyCheckedOut = 'already_checked_out';
    case NotCheckedIn = 'not_checked_in';
    case TooEarly = 'too_early';
    case OutsideGeofence = 'outside_geofence';
    case NoOfficeLocation = 'no_office_location';
    case NoteRequired = 'note_required';
    case DayHasRequest = 'day_has_request';
    case QrInvalid = 'qr_invalid';
    case QrExpired = 'qr_expired';
    case QrWrongLocation = 'qr_wrong_location';
}
