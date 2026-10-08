import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Uso: npm run user:create -- <usuario> <contraseña>
const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
  console.error("Uso: npm run user:create -- <usuario> <contraseña (mín. 8 caracteres)>");
  process.exit(1);
}

const db = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);
await db.user.upsert({
  where: { username },
  create: { username, passwordHash },
  update: { passwordHash },
});
console.log(`Usuario "${username}" listo.`);
await db.$disconnect();
