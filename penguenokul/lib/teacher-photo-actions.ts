"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/lib/session";

export type PhotoState = { error?: string; ok?: boolean } | undefined;

const MAX_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "teachers");
const PUBLIC_PREFIX = "/uploads/teachers/";

// Dosya uzantısı değil, içerik (sihirli baytlar) belirler; sahte uzantılı dosyalar reddedilir.
function detectImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export async function uploadTeacherPhotoAction(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const { teacher } = await requireTeacher();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Lütfen bir fotoğraf seç." };
  if (file.size > MAX_BYTES) return { error: "Fotoğraf en fazla 2 MB olabilir." };

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = detectImage(buf);
  if (!ext) return { error: "Yalnızca JPG, PNG veya WebP yükleyebilirsin." };

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${teacher.id}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, fileName), buf);

  const previous = teacher.photo;
  await prisma.teacherProfile.update({ where: { id: teacher.id }, data: { photo: PUBLIC_PREFIX + fileName } });

  // Eski fotoğrafı sil (yalnızca kendi yükleme klasöründeyse)
  if (previous?.startsWith(PUBLIC_PREFIX)) {
    await unlink(path.join(UPLOAD_DIR, path.basename(previous))).catch(() => {});
  }

  revalidatePath("/ogretmen/profil");
  revalidatePath("/ogrenci/ders-al");
  return { ok: true };
}

export async function removeTeacherPhotoAction(): Promise<void> {
  const { teacher } = await requireTeacher();
  const previous = teacher.photo;
  await prisma.teacherProfile.update({ where: { id: teacher.id }, data: { photo: null } });
  if (previous?.startsWith(PUBLIC_PREFIX)) {
    await unlink(path.join(UPLOAD_DIR, path.basename(previous))).catch(() => {});
  }
  revalidatePath("/ogretmen/profil");
  revalidatePath("/ogrenci/ders-al");
}
