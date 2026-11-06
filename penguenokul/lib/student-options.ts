// "use server" dosyaları yalnızca async fonksiyon dışa aktarabilir; ortak seçenekler burada durur.
export const GRADES = ["5", "6", "7", "8", "9", "10", "11", "12", "mezun"] as const;
export const TARGET_EXAMS = ["LGS", "YKS", "KPSS", "Diğer"] as const;
