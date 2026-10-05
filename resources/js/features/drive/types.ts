/** Matches App\Domain\Google\Enums\DriveFileKind. */
export type DriveFileKind =
    | 'doc'
    | 'sheet'
    | 'slide'
    | 'pdf'
    | 'image'
    | 'folder'
    | 'other';

/** App\Http\Resources\DriveFileResource */
export type DriveFileData = {
    id: string;
    google_file_id: string;
    name: string;
    mime_type: string;
    kind: DriveFileKind;
    kind_label: string;
    web_view_link: string;
    preview_url: string | null;
    icon_link: string | null;
    size_bytes: number | null;
    owner_email: string | null;
    modified_at: string | null;
    added_by: { id: string; name: string } | null;
    /** The file was removed from Drive (cached row soft-deleted). */
    deleted: boolean;
};

/** App\Http\Resources\AttachmentResource */
export type AttachmentData = {
    id: string;
    source: 'drive' | 'storage';
    filename: string;
    mime_type: string;
    size_bytes: number | null;
    created_at: string | null;
    uploaded_by: { id: string; name: string } | null;
    drive_file: DriveFileData | null;
};

/** GET /google/picker-token (PickerTokenController). */
export type PickerTokenResponse =
    | {
          status: 'ready';
          access_token: string;
          expires_at: string | null;
          developer_key: string;
          app_id: string;
          locale: string;
      }
    | { status: 'not_configured'; message: string }
    | {
          status: 'not_connected' | 'reconnect_required';
          message: string;
          connect_url: string;
      }
    | { status: 'error'; message: string };

/** A file chosen in Google Picker (subset of google.picker.DocumentObject). */
export type PickedDriveFile = {
    id: string;
    name: string;
    mimeType: string;
    url: string;
};

/** Props of the settings/google page (GoogleSettingsController). */
export type GoogleSettingsData = {
    drive_enabled: boolean;
    connect_enabled: boolean;
    picker_enabled: boolean;
    fake: boolean;
    account: {
        email: string;
        connected_at: string | null;
        has_drive_access: boolean;
        needs_reconnect: boolean;
    } | null;
    missing_settings: string[];
};
