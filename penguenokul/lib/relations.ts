import { prisma } from "@/lib/prisma";

// Durum adları, Prisma'nın ürettiği LessonStatus enum'uyla birebir aynıdır. Listeleri bu tiple
// tanımlamak hem `where: { status: { in: ... } }` hem `.includes(lesson.status)` için tip uyumu sağlar.
export type LessonStatusName =
  | "REQUESTED"
  | "CONFIRMED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export const ACTIVE_STATUSES: LessonStatusName[] = ["REQUESTED", "CONFIRMED"];
export const TRIAL_BLOCKING_STATUSES: LessonStatusName[] = ["REQUESTED", "CONFIRMED", "COMPLETED", "NO_SHOW"];

// Mesajlaşma: talep aşamasındaki öğrenci de öğretmene soru sorabilsin.
export const MESSAGE_STATUSES: LessonStatusName[] = ["REQUESTED", "CONFIRMED", "COMPLETED", "NO_SHOW"];

// Öğrenci takibi (not, ödev): yalnızca gerçekten ders ilişkisi kurulmuş öğrenciler.
export const TEACHING_STATUSES: LessonStatusName[] = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

export async function hasLessonBetween(
  teacherId: string,
  studentId: string,
  statuses: LessonStatusName[]
): Promise<boolean> {
  const found = await prisma.lesson.findFirst({
    where: { teacherId, studentId, status: { in: statuses } },
    select: { id: true },
  });
  return found !== null;
}
