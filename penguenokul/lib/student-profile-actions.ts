"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { GRADES, TARGET_EXAMS } from "@/lib/student-options";

export type StudentProfileState = { error?: string; ok?: boolean } | undefined;


const PHONE = /^[0-9+\s()-]{10,20}$/;
const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

// Öğrenci kendi profilini düzenler. Veli bilgileri yalnızca yönetici tarafında görünür;
// öğretmen sayfalarında yalnızca sınıf ve hedef sınav seçilir (bkz. teacher sayfaları).
export async function saveStudentProfileAction(
  _prev: StudentProfileState,
  formData: FormData
): Promise<StudentProfileState> {
  const { student } = await requireStudent();

  const name = clean(formData.get("name"));
  const phone = clean(formData.get("phone"));
  const grade = clean(formData.get("grade"));
  const targetExam = clean(formData.get("targetExam"));
  const parentName = clean(formData.get("parentName"));
  const parentPhone = clean(formData.get("parentPhone"));
  const smsConsent = formData.get("smsConsent") === "on";

  if (name.length < 2 || name.length > 80) return { error: "Ad soyad 2-80 karakter arasında olmalı." };
  if (phone && !PHONE.test(phone)) return { error: "Telefon numarası geçerli görünmüyor." };
  if (parentPhone && !PHONE.test(parentPhone)) return { error: "Veli telefonu geçerli görünmüyor." };
  if (smsConsent && !phone) return { error: "SMS hatırlatma için telefon numarası girmelisin." };
  if (parentName.length > 80) return { error: "Veli adı en fazla 80 karakter olabilir." };
  // İstemciden gelen değerlere güvenme: yalnızca tanımlı seçenekler kabul edilir
  if (grade && !(GRADES as readonly string[]).includes(grade)) return { error: "Geçersiz sınıf seçimi." };
  if (targetExam && !(TARGET_EXAMS as readonly string[]).includes(targetExam)) {
    return { error: "Geçersiz sınav seçimi." };
  }

  await prisma.studentProfile.update({
    where: { id: student.id },
    data: {
      name,
      phone: phone || null,
      grade: grade || null,
      targetExam: targetExam || null,
      parentName: parentName || null,
      parentPhone: parentPhone || null,
      smsConsent,
    },
  });

  revalidatePath("/ogrenci");
  revalidatePath("/ogrenci/profil");
  return { ok: true };
}
