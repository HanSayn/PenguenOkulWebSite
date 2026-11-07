// Arama gibi yerlerde büyük/küçük harf duyarsızlığı: PostgreSQL'de `mode: "insensitive"` gerekir.
// SQLite'ta (yalnızca test düzeneği) bu seçenek tanımsızdır ve zaten ASCII için duyarsız çalışır.
const isPostgres = /^postgres(ql)?:/.test(process.env.DATABASE_URL ?? "");
export const insensitive: { mode?: "insensitive" } = isPostgres ? { mode: "insensitive" } : {};
