/** Kalimat ringkas baris rekap: "Hadir 8/9 · terlambat 1× (12 m) · izin 1". */
import type { BarisRekap } from '@/api/hr';

import { angka } from '../format';

export function ringkasBaris(r: BarisRekap): string {
  const bagian = [`Hadir ${r.presentDays}/${r.workDays}`];
  bagian.push(`terlambat ${r.lateCount}×${r.lateMinutes > 0 ? ` (${r.lateMinutes} m)` : ''}`);
  if (r.absentDays > 0) bagian.push(`alpha ${r.absentDays}`);
  const izin = r.leaveDays + r.permitDays + r.sickDays;
  if (izin > 0) bagian.push(`cuti/izin/sakit ${angka(izin)}`);
  if (r.businessTripDays > 0) bagian.push(`dinas ${angka(r.businessTripDays)}`);
  if (r.wfhDays > 0) bagian.push(`WFH ${r.wfhDays}`);
  if (r.overtimeHours > 0) bagian.push(`lembur ${angka(r.overtimeHours)} j`);
  if (r.needsCorrectionDays > 0) bagian.push(`perlu koreksi ${r.needsCorrectionDays}`);
  return bagian.join(' · ');
}
