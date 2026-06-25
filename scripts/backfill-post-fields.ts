import { PrismaClient } from '@prisma/client';
import { buildRandomPostFields } from './post-random-fields';

async function backfillPostFields() {
  const prisma = new PrismaClient();

  try {
    const posts = await prisma.post.findMany({
      select: { id: true },
    });

    if (posts.length === 0) {
      console.log('Постов для backfill не найдено');
      return;
    }

    let updated = 0;

    for (const post of posts) {
      await prisma.post.update({
        where: { id: post.id },
        data: buildRandomPostFields(),
      });
      updated += 1;
    }

    console.log(`Обновлено постов: ${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

backfillPostFields().catch(error => {
  console.error('Не удалось выполнить backfill постов:', error);
  process.exit(1);
});
