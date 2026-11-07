import "dotenv/config"; // Prisma CLI, yapılandırma dosyası varken .env'yi kendiliğinden okumaz
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
});
