/**
 * Kontrak tipe JSON API ponsel /api/v1 — diturunkan persis dari
 * routes/api.php + presenter Laravel (tests/Feature/Api/*).
 */

// ── Sesi & profil ────────────────────────────────────────────────────────────

export interface WorkMode {
  value: string;
  label: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  jabatan: string | null;
  divisi: string | null;
  work_mode: WorkMode;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface DeviceInfo {
  platform: 'android' | 'ios' | 'web';
  device_id_hash: string;
  name: string | null;
  os_version: string | null;
  app_version: string | null;
}

// ── Absensi ──────────────────────────────────────────────────────────────────

export type AttendanceAction = 'check_in' | 'check_out' | 'done' | 'unavailable';

export interface DaySchedule {
  workDate: string;
  isWorkday: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isOverride: boolean;
  shiftName: string | null;
  hours: string | null;
  start: string | null;
  end: string | null;
  checkInOpensAt: string | null;
  lateThreshold: string | null;
  workMode: string;
  workModeLabel: string;
  allowsRemote: boolean;
}

export interface AttendanceLog {
  id: string;
  type: 'check_in' | 'check_out';
  method: string;
  methodLabel: string;
  occurredAt: string | null;
  locationName: string | null;
  distanceM: number | null;
  inside: boolean;
  note: string | null;
  isSuspicious: boolean;
  selfieUrl: string | null;
}

export interface AttendanceDay {
  id: string;
  workDate: string;
  status: string;
  statusLabel: string;
  shiftName: string | null;
  hours: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  isSuspicious: boolean;
  requestPortion: string | null;
  workPlan: string[] | null;
  checkIn: AttendanceLog | null;
  checkOut: AttendanceLog | null;
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusM: number;
}

export interface TodayAttendance {
  today: {
    action: AttendanceAction;
    schedule: DaySchedule;
    day: AttendanceDay | null;
    locations: OfficeLocation[];
  };
  serverTime: string;
}

export interface AttendanceResult {
  type: 'check_in' | 'check_out';
  workDate: string;
  occurredAt: string | null;
  status: string;
  statusLabel: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  minutesBeforeStart: number | null;
  method: string;
  methodLabel: string;
  location: {
    name: string;
    distanceM: number | null;
    radiusM: number;
    inside: boolean;
  } | null;
  shift: { name: string; hours: string } | null;
  isSuspicious: boolean;
  selfieUrl: string | null;
}

export interface RecapDayCell {
  date: string;
  kind: string;
  isWorkday: boolean;
  holidayName: string | null;
  dayId: string | null;
  statusLabel: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
  isSuspicious: boolean;
  shiftName: string | null;
  checkIn: AttendanceLog | null;
  checkOut: AttendanceLog | null;
}

export interface AttendanceHistory {
  period: {
    month: string;
    label: string;
    start: string;
    end: string;
    countedUntil: string | null;
    isRunning: boolean;
    previous: string;
    next: string;
  };
  recap: {
    name: string;
    shiftName: string | null;
    workDays: number;
    presentDays: number;
    lateCount: number;
    lateMinutes: number;
    earlyLeaveCount: number;
    absentDays: number;
    leaveDays: number;
    permitDays: number;
    sickDays: number;
    businessTripDays: number;
    wfhDays: number;
    offDays: number;
    attendanceRate: number | null;
    days: RecapDayCell[];
  };
}

// ── Tugas ────────────────────────────────────────────────────────────────────

export type TaskSource = 'manual' | 'attendance';

export interface TaskStatusInfo {
  id?: string;
  name: string;
  category: string;
  is_done: boolean;
}

export interface TodayTaskItem {
  id: string;
  key: string;
  title: string;
  workspace: { key: string; name: string };
  status: TaskStatusInfo;
  priority: string;
  assignees: string[];
  source: TaskSource;
}

export interface TodayTasks {
  today: string;
  pribadi: TodayTaskItem[];
  tim: TodayTaskItem[];
  semua: TodayTaskItem[];
  counts: { pribadi: number; tim: number; semua: number };
}

export interface TaskListItem {
  id: string;
  key: string;
  title: string;
  workspace: { key: string; name: string };
  status: TaskStatusInfo;
  priority: { value: number; label: string };
  due_date: string | null;
  assignees: string[];
  source: TaskSource;
}

export type AnggotaWorkspace = { id: string; name: string; avatar: string | null; role: string };

export interface TaskDetail extends TaskListItem {
  description_text: string | null;
  start_date: string | null;
  checklist: { done: number; total: number } | null;
  url: string;
  created_at: string | null;
  completed_at: string | null;
  can?: { edit: boolean; delete: boolean; comment: boolean };
}

export interface PageMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface TaskPage {
  tasks: TaskListItem[];
  meta: PageMeta;
}

// ── Tugas tulis (Tahap 2) ────────────────────────────────────────────────────

/** POST /tugas — tanpa penanggung (kontrak belum mengirim daftar anggota). */
export interface TaskStoreBody {
  workspace_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: number;
}

/** PATCH /tugas/{task} — sebagian; assignee_ids tak dipakai aplikasi v1. */
export interface TaskUpdateBody {
  title?: string;
  description?: string | null;
  due_date?: string | null;
  priority?: number;
}

// ── Komentar tugas (Tahap 2) ─────────────────────────────────────────────────

export interface TaskCommentAuthor {
  id: string;
  name: string;
  avatar: string | null;
}

/** CommentResource web — body/body_text null bila komentar dihapus. */
export interface TaskComment {
  kind: 'comment';
  id: string;
  task_id: string;
  author: TaskCommentAuthor | null;
  body: string | null;
  body_text: string | null;
  created_at: string | null;
  edited_at: string | null;
  deleted: boolean;
  reactions: { emoji: string; count: number; user_ids: string[]; names: string[] }[];
  attachments: unknown[];
}

export interface CommentPage {
  comments: TaskComment[];
  meta: PageMeta;
}

// ── Papan workspace (Tahap 2) ────────────────────────────────────────────────

export type BoardTaskCategory = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'canceled';

/** TaskResource web (kartu papan) — assignee hanya id, bukan nama. */
export interface BoardTask {
  id: string;
  workspace_id: string;
  number: number;
  key: string;
  title: string;
  description_text: string | null;
  status_id: string;
  status_category: BoardTaskCategory;
  priority: number;
  position: number;
  start_date: string | null;
  due_date: string | null;
  estimate_hours: number | null;
  parent_id: string | null;
  parent_key: string | null;
  assignee_ids: string[];
  assignees?: { id: string; nama: string | null }[];
  label_ids: string[];
  checklist: { done: number; total: number } | null;
  created_by: string;
  created_at: string | null;
  completed_at: string | null;
  comments?: { count: number; unread: boolean };
}

/** Kolom papan — `color` nama palet (gray…pink, lihat lib/palette). */
export interface BoardColumn {
  id: string;
  name: string;
  kategori: BoardTaskCategory;
  color: string;
  posisi: number;
  tasks: BoardTask[];
}

export interface WorkspaceBoard {
  workspace: { id: string; key: string; name: string };
  columns: BoardColumn[];
  hidden_closed_count: number;
}

// ── Catatan (Tahap 2) ────────────────────────────────────────────────────────

/** Baris NoteLibrary web + nama penulis/penyunting dari endpoint ponsel. */
export interface NoteRow {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  kind: 'note' | 'folder';
  preset: string | null;
  title: string;
  access: string;
  created_by: string | null;
  updated_by: string | null;
  position: number;
  created_at: string | null;
  updated_at: string | null;
  penulis: string | null;
  penyunting: string | null;
}

export interface WorkspaceNotes {
  workspace: { id: string; key: string; name: string };
  can_create: boolean;
  notes: NoteRow[];
}

/** NoteDetail — folder menjawab body_html/body_text null. */
export interface NoteDetailData extends NoteRow {
  workspace_key: string | null;
  workspace_type: string | null;
  can_edit: boolean;
  can_share: boolean;
  can_delete: boolean;
  body_html: string | null;
  body_text: string | null;
  /** False for rich notes the plain-text editor would flatten; missing on older servers = editable. */
  mobile_editable?: boolean;
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export interface InboxItem {
  id: string;
  type: string;
  category: string;
  icon: string;
  tone: string;
  type_label: string;
  title: string;
  body: string | null;
  url: string | null;
  actor: { name?: string } | null;
  subject: unknown;
  meta: Record<string, unknown> | Record<string, never>;
  action_required: boolean;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface InboxPage {
  items: InboxItem[];
  unread: number;
  meta: PageMeta;
}

// ── Briefing ─────────────────────────────────────────────────────────────────

export interface Briefing {
  period: string;
  label: string;
  date: string;
  content: string;
  oleh: string;
  updated_at: string | null;
}

// ── Workspace ────────────────────────────────────────────────────────────────

export interface WorkspaceItem {
  id: string;
  key: string;
  name: string;
  arsip: boolean;
}

export interface WorkspaceGroups {
  groups: { jenis: string; label: string; items: WorkspaceItem[] }[];
}

// ── Pengajuan ────────────────────────────────────────────────────────────────

export interface LeaveTypeInfo {
  id: string;
  code: string;
  name: string;
  category: string;
  category_label: string;
  description: string | null;
  annual_quota_days: number | null;
  requires_attachment_after_days: number | null;
  allow_half_day: boolean;
  max_backdate_days: number | null;
  is_paid: boolean;
  counts_calendar_days: boolean;
  max_days_per_request: number | null;
  day_unit: string;
  is_provisional_default: boolean;
  locked: boolean;
  locked_reason: string | null;
}

export interface RequestCategoryInfo {
  value: string;
  label: string;
  slug: string;
  types: LeaveTypeInfo[];
}

export interface RequestTypes {
  categories: RequestCategoryInfo[];
}

export interface PersonInfo {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  division: string | null;
}

export interface EmployeeRequestRow {
  id: string;
  number: string;
  status: string;
  status_label: string;
  type: LeaveTypeInfo;
  user: PersonInfo;
  start_at: string;
  end_at: string;
  days: number | null;
  minutes: number | null;
  payload: Record<string, unknown>;
  round: number;
  step_position: number | null;
  step_count: number;
  waiting: { label: string; approver: PersonInfo | null; since: string | null } | null;
  decision_note: { status: string; note: string | null; by: string | null; at: string | null } | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface RequestPage {
  requests: EmployeeRequestRow[];
  meta: PageMeta;
}

// ── Obrolan (Tahap 2, di balik flag features.chat — 404 saat mati) ───────────

export type ChannelType = 'workspace' | 'public' | 'private' | 'dm' | 'group';

export interface ChatChannelMember {
  user_id: string;
  last_read_message_id: string | null;
  muted: boolean;
  role: string;
}

/** ChatPresenter::channel + state unread/preview/izin dari ChatInbox. */
export interface ChatChannel {
  id: string;
  workspace_id: string | null;
  workspace: { key: string; name: string; color: string } | null;
  type: ChannelType;
  name: string | null;
  topic: string | null;
  created_by: string;
  created_at: string | null;
  archived_at: string | null;
  members: ChatChannelMember[];
  unread_count: number;
  last_message: {
    id: string;
    user_id: string | null;
    body_text: string;
    created_at: string | null;
    deleted: boolean;
  } | null;
  can_post: boolean;
  can_manage: boolean;
}

/** ChatPresenter::message — body = dokumen Tiptap; aplikasi hanya memakai body_text. */
export interface ChatMessage {
  penulis?: { id: string; nama: string | null };
  id: string;
  channel_id: string;
  user_id: string;
  parent_id: string | null;
  body: Record<string, unknown> | null;
  body_text: string;
  created_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: { emoji: string; user_ids: string[] }[];
  attachments: unknown[];
}

/** Tugas yang direferensikan pesan (#KEY-n) yang terlihat pemilik. */
export interface ChatTaskRef {
  id: string;
  key: string;
  title: string;
  status_category: BoardTaskCategory;
  url: string;
}

/**
 * Satu halaman timeline: pesan utama tua→baru lalu balasan runtutannya
 * (parent_id terisi); `has_more` = masih ada pesan lebih tua (scroll balik
 * pakai id pesan utama tertua lewat ?sebelum=).
 */
export interface ChatTimeline {
  messages: ChatMessage[];
  tasks: ChatTaskRef[];
  has_more: boolean;
}

// ── Rapat (Tahap 2, di balik flag features.meetings — 404 saat mati) ────────

export type RsvpValue = 'yes' | 'maybe' | 'no' | 'pending';
export type RentangRapat = 'hari-ini' | 'minggu-ini' | 'akan-datang';

/** Satu baris agenda (MeetingSummary::agenda) — waktu ISO UTC, aplikasi memformat WIB. */
export interface MeetingItem {
  id: string;
  key: string;
  occurrence_date: string;
  title: string;
  starts_at: string;
  ends_at: string;
  platform: string;
  platform_label: string;
  location: string | null;
  join_url: string | null;
  organizer: { id: string; name: string | null };
  workspace: { id: string; key: string; name: string } | null;
  peserta_count: number;
  rsvp_saya: RsvpValue | null;
  terjadi_hari_ini: boolean;
  dapat_diedit: boolean;
  recurrence: string;
  recurrence_until: string | null;
  canceled: boolean;
  minutes_status: 'none' | 'draft' | 'final';
}

export interface MeetingAgenda {
  rentang: string;
  from: string;
  to: string;
  hari_ini: string;
  server_time: string;
  items: MeetingItem[];
}

export interface MeetingParticipantRow {
  user_id: string | null;
  email: string | null;
  nama: string | null;
  rsvp: RsvpValue;
  optional: boolean;
}

/** Detail satu kemunculan (MeetingSummary::detail). */
export interface MeetingDetailData extends MeetingItem {
  description: string | null;
  agenda_items: string[];
  reminders: unknown[];
  minute_taker: { id: string; name: string | null } | null;
  leadership: boolean;
  auto_minutes: boolean;
  participants: MeetingParticipantRow[];
  notulen: { status: 'none' | 'draft' | 'final'; ada_isi: boolean };
}

/** Ringkasan ruang video platform `video` — tautan gabung = halaman web, tanpa token Livekit. */
export interface MeetingVideoRoom {
  configured: boolean;
  join_href: string;
  opens_at: string;
  closes_at: string;
  can_join: boolean;
  denied_reason: string | null;
}

export interface MeetingDetailResponse {
  meeting: MeetingDetailData;
  can: { rsvp: boolean; edit: boolean; join_video: boolean };
  video: MeetingVideoRoom | null;
}

export interface MinutesPerson {
  id: string;
  name: string;
  title: string;
  division: string;
  avatar_url: string | null;
}

/** MeetingPresenter::minutes — id null = belum ditulis (draf kosong dari agenda). */
export interface MeetingMinutesData {
  id: string | null;
  meeting_id: string;
  meeting_key: string;
  href: string;
  status: 'draft' | 'final';
  saved_at: string | null;
  version_count: number;
  finalized_at: string | null;
  co_editor_id: null;
  attendance: { user_id: string; present: boolean; reason: string | null }[];
  sections: { title: string; body: string }[];
  decisions: string[];
  action_items: {
    id: string;
    text: string;
    assignee_id: string | null;
    due_date: string | null;
    task_key: string | null;
    task_url: string | null;
    done: boolean;
  }[];
  source: string | null;
}

export interface MeetingMinutesResponse {
  meeting: MeetingDetailData;
  notulen: MeetingMinutesData;
  people: MinutesPerson[];
}

// ── Kalender (Tahap 2, flag meetings) ───────────────────────────────────────

export type CalendarLayer = 'meetings' | 'tasks' | 'leave' | 'holidays';

/** Entri flat CalendarFeed — aplikasi mengelompokkan per `date` sendiri. */
export interface CalendarEntry {
  id: string;
  layer: CalendarLayer;
  date: string;
  title: string;
  meta: string;
  href?: string;
  end_date?: string;
  overdue?: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  from: string;
  to: string;
  entries: CalendarEntry[];
}

// ── Perangkat ────────────────────────────────────────────────────────────────

export interface DeviceRow {
  id: string;
  platform: string;
  platform_label: string;
  name: string | null;
  os_version: string | null;
  app_version: string | null;
  biometric_login: boolean;
  has_push_token: boolean;
  is_current: boolean;
  last_seen_at: string | null;
  created_at: string | null;
}
