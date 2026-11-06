import type { Tx } from "@/lib/prisma";

// Transaction istemcisi (Tx) beklenir; normal PrismaClient de Tx'in üst kümesi olduğu için kabul edilir.
// Denetim kaydı, kaydı doğuran işlemle aynı transaction'da yazılırsa "işlem oldu ama kayıt yok" olmaz.
type Db = Tx;

type Snapshot = Record<string, string | number | boolean | null>;

export async function logAudit(
  db: Db,
  entry: {
    adminId: string;
    action: string; // "teacher.approve", "lesson.cancel", "settings.update" ...
    targetType: string;
    targetId: string;
    before?: Snapshot;
    after?: Snapshot;
  }
) {
  await db.auditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      before: entry.before,
      after: entry.after,
    },
  });
}
