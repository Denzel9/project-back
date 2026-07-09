import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

async function main() {
  const migrationName =
    process.argv[2] ?? '20260624140000_task_brief_deliverables_fields';
  const migrationPath = join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    migrationName,
    'migration.sql'
  );

  const content = readFileSync(migrationPath);
  const checksum = createHash('sha256').update(content).digest('hex');

  console.log(`Migration: ${migrationName}`);
  console.log(`New checksum: ${checksum}`);

  const prisma = new PrismaClient();

  try {
    const updated = await prisma.$executeRaw`
      UPDATE "_prisma_migrations"
      SET "checksum" = ${checksum}
      WHERE "migration_name" = ${migrationName}
    `;

    console.log(`Updated ${updated} row(s) in _prisma_migrations`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
