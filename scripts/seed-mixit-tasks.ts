import {
  PostAuthorType,
  PrismaClient,
  Role,
  TaskStatus,
} from '@prisma/client';

const DEFAULT_COUNT = 100;
const SEED_TITLE_PREFIX = 'Mixit seed task';
const SEED_POST_TITLE_PREFIX = 'Mixit seed post';

const force = process.argv.includes('--force');
const countArg = process.argv.find(arg => arg.startsWith('--count='));
const companyArg = process.argv.find(arg => arg.startsWith('--company='));

const COUNT = countArg ? Number(countArg.split('=')[1]) : DEFAULT_COUNT;
const COMPANY_QUERY = companyArg
  ? companyArg.split('=')[1]
  : 'mixit';

const TASK_STATUSES: TaskStatus[] = [
  TaskStatus.PREPARING,
  TaskStatus.PENDING_APPROVAL,
  TaskStatus.IN_PROGRESS,
  TaskStatus.CHECKING,
  TaskStatus.REVISION,
  TaskStatus.COMPLETED,
  TaskStatus.CANCELLED,
  TaskStatus.CANCELLED_EXECUTOR,
];

function assertCount(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('--count должен быть целым числом >= 1');
  }
}

async function findCompany(prisma: PrismaClient) {
  const company = await prisma.user.findFirst({
    where: {
      role: Role.COMPANY,
      OR: [
        { email: { contains: COMPANY_QUERY, mode: 'insensitive' } },
        {
          companyProfile: {
            companyName: { contains: COMPANY_QUERY, mode: 'insensitive' },
          },
        },
      ],
    },
    include: {
      companyProfile: true,
    },
  });

  if (!company) {
    throw new Error(
      `Компания не найдена (поиск: "${COMPANY_QUERY}"). ` +
        'Укажите --company=название или email.'
    );
  }

  return company;
}

async function findCreators(prisma: PrismaClient): Promise<string[]> {
  const creators = await prisma.user.findMany({
    where: { role: Role.CREATOR },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (creators.length === 0) {
    throw new Error(
      'В БД нет креаторов для назначения исполнителями. Создайте хотя бы одного CREATOR.'
    );
  }

  return creators.map(creator => creator.id);
}

async function clearSeedTasks(prisma: PrismaClient, ownerId: string) {
  const deleted = await prisma.task.deleteMany({
    where: {
      ownerId,
      title: { startsWith: SEED_TITLE_PREFIX },
    },
  });

  console.log(`Удалено seed-задач: ${deleted.count}`);
}

async function ensurePosts(
  prisma: PrismaClient,
  ownerId: string,
  minPosts: number
): Promise<string[]> {
  const existing = await prisma.post.findMany({
    where: {
      ownerId,
      isArchived: false,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const postIds = existing.map(post => post.id);
  const needed = Math.max(0, Math.min(minPosts, 20) - postIds.length);

  for (let i = 0; i < needed; i++) {
    const num = postIds.length + i + 1;
    const post = await prisma.post.create({
      data: {
        title: `${SEED_POST_TITLE_PREFIX} #${num}`,
        ownerId,
        type: PostAuthorType.COMPANY,
        description: `Тестовый пост Mixit для seed-задач #${num}`,
        categories: ['seed', 'mixit'],
        keyWords: ['mixit', 'seed'],
      },
      select: { id: true },
    });

    postIds.push(post.id);
    console.log(`Создан пост: ${post.id}`);
  }

  if (postIds.length === 0) {
    throw new Error('Не удалось найти или создать посты компании');
  }

  return postIds;
}

async function seedMixitTasks() {
  assertCount(COUNT);

  const prisma = new PrismaClient();

  try {
    const company = await findCompany(prisma);
    const companyLabel =
      company.companyProfile?.companyName ?? company.email;

    console.log(`Компания: ${companyLabel} (${company.id})`);

    if (force) {
      await clearSeedTasks(prisma, company.id);
    }

    const existing = await prisma.task.count({
      where: {
        ownerId: company.id,
        title: { startsWith: SEED_TITLE_PREFIX },
      },
    });

    if (existing >= COUNT) {
      console.log(`Задачи Mixit: уже есть ${existing}, пропуск`);
      return;
    }

    const toCreate = COUNT - existing;
    const creatorIds = await findCreators(prisma);
    const postIds = await ensurePosts(prisma, company.id, toCreate);

    let created = 0;

    for (let i = 0; i < toCreate; i++) {
      const taskNum = existing + i + 1;
      const postId = postIds[i % postIds.length];
      const executorId = creatorIds[i % creatorIds.length];
      const status = TASK_STATUSES[i % TASK_STATUSES.length];
      const daysAhead = 3 + (i % 30);

      await prisma.task.create({
        data: {
          postId,
          ownerId: company.id,
          executorId,
          applicationId: null,
          title: `${SEED_TITLE_PREFIX} #${taskNum}`,
          description: `Seed-задача Mixit #${taskNum} для демо и тестов ленты.`,
          status,
          urgent: i % 7 === 0,
          photoCount: String((i % 5) + 1),
          videoCount: String(i % 3),
          isExecutorApprove: i % 4 === 0 ? true : i % 5 === 0 ? null : false,
          isCompanyAction: i % 3 !== 0,
          finalDate: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
        },
      });

      created++;
    }

    const total = await prisma.task.count({
      where: {
        ownerId: company.id,
        title: { startsWith: SEED_TITLE_PREFIX },
      },
    });

    console.log(`Создано задач: ${created}`);
    console.log(`Всего seed-задач Mixit: ${total}`);
  } finally {
    await prisma.$disconnect();
  }
}

seedMixitTasks().catch(error => {
  console.error('Не удалось создать задачи Mixit:', error);
  process.exit(1);
});
