import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use DIRECT_URL (Supabase session pooler, port 5432).
// The running app uses DATABASE_URL (see src/lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
