"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { parseTLToKurus } from "@/lib/money";

export type PackageState = { error?: string; ok?: boolean } | undefined;

// Paket oluştur / güncelle. Satın alınmış paketler değişmez: fiyat ve ders sayısı satın alma anında
// Payment ve Purchase'a kopyalanır. Paketler silinmez, yalnızca pasife alınır.
export async function savePackageAction(_prev: PackageState, formData: FormData): Promise<PackageState> {
  const { user: admin } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const lessonCount = Number(formData.get("lessonCount"));
  const durationMonths = Number(formData.get("durationMonths"));
  const price = parseTLToKurus(String(formData.get("price") ?? ""));

  if (name.length < 3 || name.length > 60) return { error: "Paket adı 3-60 karakter olmalı." };
  if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 200) return { error: "Ders sayısı 1-200 arasında olmalı." };
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 24) return { error: "Geçerlilik 1-24 ay arasında olmalı." };
  if (price === null) return { error: "Fiyat geçerli değil (ör. 2400 veya 2.400,50)." };
  if (price < lessonCount) return { error: "Fiyat, ders sayısından düşük olamaz." };

  if (id && !(await prisma.package.findUnique({ where: { id }, select: { id: true } }))) {
    return { error: "Paket bulunamadı." };
  }

  await prisma.$transaction(async (tx: Tx) => {
    if (id) {
      const before = await tx.package.findUniqueOrThrow({ where: { id } });
      await tx.package.update({ where: { id }, data: { name, lessonCount, durationMonths, price } });
      await logAudit(tx, {
        adminId: admin.id, action: "package.update", targetType: "Package", targetId: id,
        before: { name: before.name, lessonCount: before.lessonCount, durationMonths: before.durationMonths, price: before.price },
        after: { name, lessonCount, durationMonths, price },
      });
    } else {
      const created = await tx.package.create({ data: { name, lessonCount, durationMonths, price } });
      await logAudit(tx, { adminId: admin.id, action: "package.create", targetType: "Package", targetId: created.id, after: { name, lessonCount, durationMonths, price } });
    }
  });

  revalidatePath("/admin/paketler");
  revalidatePath("/ogrenci/paketler");
  return { ok: true };
}

export async function togglePackageAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const pkg = await prisma.package.findUnique({ where: { id } });
  if (!pkg) return;
  await prisma.$transaction(async (tx: Tx) => {
    await tx.package.update({ where: { id }, data: { isActive: !pkg.isActive } });
    await logAudit(tx, { adminId: admin.id, action: "package.toggle", targetType: "Package", targetId: id, before: { isActive: pkg.isActive }, after: { isActive: !pkg.isActive } });
  });
  revalidatePath("/admin/paketler");
  revalidatePath("/ogrenci/paketler");
}
