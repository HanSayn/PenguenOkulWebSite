// Zamanlanmış işleri komut satırından çalıştırır: npm run jobs
// Kendi sunucunda (VPS) sistem crontab ile kullanılabilir: */5 * * * * cd /app && npm run jobs
import { runScheduledJobs } from "../lib/jobs";
import { prisma } from "../lib/prisma";

runScheduledJobs()
  .then((report) => {
    console.log(JSON.stringify({ ok: true, ...report }));
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
