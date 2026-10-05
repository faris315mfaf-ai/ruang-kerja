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

/** A task that attaches a Drive file ("Dipakai di tugas": PLQ-21). */
export type DriveFileTaskRef = { key: string; title: string; url: string };

/** Row of the File/Dokumen tabs (WorkspaceDriveListing::rows). */
export type DriveFileRow = DriveFileData & {
    parent_id: string | null;
    /** Linked with Google Picker from outside the workspace folder. */
    linked: boolean;
    /** Cached children of a folder ("9 file"), null for files. */
    children_count: number | null;
    /** Who added it in RuangKerja, else the employee behind owner_email. */
    owner_name: string | null;
    used_in: DriveFileTaskRef[];
};

export type DriveAccessState =
    | 'disabled'
    | 'preparing'
    | 'unused'
    | 'error'
    | 'pending'
    | 'synced';

/** WorkspaceDriveStatus::summary(). */
export type DriveAccessSummary = {
    state: DriveAccessState;
    synced: number;
    pending: number;
    errors: number;
    total: number;
};

/** Shared `drive` prop of the File and Dokumen tabs (WorkspaceDriveListing::drive). */
export type WorkspaceDriveInfo = {
    enabled: boolean;
    fake: boolean;
    picker_enabled: boolean;
    missing_settings: string[];
    folder_url: string | null;
    folder_name: string;
    shared_drive_name: string;
    access: DriveAccessSummary;
    can_contribute: boolean;
    max_upload_bytes: number;
    chunk_bytes: number;
    syncing: boolean;
};

export type DriveAccessMemberStatus =
    | 'synced'
    | 'pending'
    | 'error'
    | 'inactive'
    | 'disabled';

/** Per-member "Akses Drive" (WorkspaceDriveStatus::members). */
export type DriveAccessMember = {
    status: DriveAccessMemberStatus;
    label: string;
    error: string | null;
    synced_at: string | null;
};

export type UploadSessionState = 'receiving' | 'processing' | 'done' | 'failed';

/** DriveUploadSession::publicData() + chunk size. */
export type UploadSessionData = {
    id: string;
    filename: string;
    size: number;
    received: number;
    state: UploadSessionState;
    drive_file_id: string | null;
    attachment_id: string | null;
    message: string | null;
    chunk_bytes: number;
};

/** GET /lampiran/{type}/{id} (AttachmentController::payload). */
export type AttachmentsPayload = {
    attachments: (AttachmentData & { can_remove: boolean })[];
    can_edit: boolean;
    drive: AttachmentsDriveInfo;
};

/** AttachmentList::drive(): what the attach controls need. */
export type AttachmentsDriveInfo = {
    enabled: boolean;
    fake: boolean;
    picker_enabled: boolean;
    max_upload_bytes: number;
    chunk_bytes: number;
};
