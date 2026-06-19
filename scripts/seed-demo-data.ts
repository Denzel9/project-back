import {
  ApplicationStatus,
  PrismaClient,
  Role,
} from '@prisma/client';

const COUNT = 100;
const MIN_USERS = 15;
const SEED_APP_PREFIX = 'Seed-отклик';
const SEED_COMMENT_PREFIX = 'Seed-комментарий';
const SEED_MESSAGE_PREFIX = 'Seed-сообщение';

const force = process.argv.includes('--force');

function uniquePairs(userIds: string[], count: number): [string, string][] {
  const pairs: [string, string][] = [];

  for (let i = 0; i < userIds.length && pairs.length < count; i++) {
    for (let j = i + 1; j < userIds.length && pairs.length < count; j++) {
      pairs.push([userIds[i], userIds[j]]);
    }
  }

  return pairs;
}

async function ensureUsers(prisma: PrismaClient): Promise<string[]> {
  const existing = await prisma.user.findMany({
    where: { role: { in: [Role.CREATOR, Role.COMPANY] } },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  const userIds = existing.map(user => user.id);
  const needed = Math.max(0, MIN_USERS - existing.length);

  for (let i = 0; i < needed; i++) {
    const num = existing.length + i + 1;
    const role = num % 2 === 0 ? Role.CREATOR : Role.COMPANY;
    const email = `seed-user-${String(num).padStart(3, '0')}@demo.local`;

    const user = await prisma.user.create({
      data: {
        email,
        role,
        ...(role === Role.CREATOR
          ? {
              creatorProfile: {
                create: { name: 'Seed', lastName: `User${num}` },
              },
            }
          : {
              companyProfile: {
                create: { companyName: `Seed Co ${num}` },
              },
            }),
      },
    });

    userIds.push(user.id);
    console.log(`Создан seed-пользователь: ${email}`);
  }

  return userIds;
}

async function clearSeedData(prisma: PrismaClient) {
  const seedMessages = await prisma.message.findMany({
    where: { content: { startsWith: SEED_MESSAGE_PREFIX } },
    select: { conversationId: true },
  });
  const conversationIds = [
    ...new Set(seedMessages.map(message => message.conversationId)),
  ];

  if (conversationIds.length > 0) {
    await prisma.conversation.deleteMany({
      where: { id: { in: conversationIds } },
    });
  }

  await prisma.postApplication.deleteMany({
    where: { message: { startsWith: SEED_APP_PREFIX } },
  });

  await prisma.user.deleteMany({
    where: { email: { endsWith: '@demo.local' } },
  });

  console.log('Старые seed-данные удалены');
}

async function seedApplications(
  prisma: PrismaClient,
  userIds: string[]
): Promise<number> {
  const existing = await prisma.postApplication.count({
    where: { message: { startsWith: SEED_APP_PREFIX } },
  });

  if (existing >= COUNT) {
    console.log(`Отклики: уже есть ${existing}, пропуск`);
    return 0;
  }

  const toCreate = COUNT - existing;
  const posts = await prisma.post.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      ownerId: true,
      photoCount: true,
      videoCount: true,
      urgent: true,
    },
    take: COUNT * 2,
    orderBy: { createdAt: 'desc' },
  });

  if (posts.length === 0) {
    throw new Error('Нет постов в БД. Сначала запустите: npm run seed:posts');
  }

  if (posts.length < COUNT) {
    console.warn(
      `Постов только ${posts.length} (нужно ${COUNT}). Запустите npm run seed:posts`
    );
  }

  const existingPairs = await prisma.postApplication.findMany({
    select: { postId: true, applicantId: true },
  });
  const pairKeys = new Set(
    existingPairs.map(pair => `${pair.postId}:${pair.applicantId}`)
  );

  const applications: {
    postId: string;
    applicantId: string;
    message: string;
    status: ApplicationStatus;
  }[] = [];

  let postIndex = 0;
  let applicantIndex = 0;
  let seedNum = existing + 1;
  let attempts = 0;
  const maxAttempts = toCreate * posts.length * userIds.length * 2;

  while (applications.length < toCreate && attempts < maxAttempts) {
    attempts++;
    const post = posts[postIndex % posts.length];
    const applicantId = userIds[applicantIndex % userIds.length];

    postIndex++;
    if (postIndex % posts.length === 0) {
      applicantIndex++;
    }

    if (applicantId === post.ownerId) {
      continue;
    }

    const key = `${post.id}:${applicantId}`;
    if (pairKeys.has(key)) {
      continue;
    }

    pairKeys.add(key);
    applications.push({
      postId: post.id,
      applicantId,
      message: `${SEED_APP_PREFIX} #${seedNum}`,
      status: ApplicationStatus.ACCEPTED,
    });
    seedNum++;
  }

  if (applications.length < toCreate) {
    throw new Error(
      `Не удалось найти ${toCreate} уникальных пар post/applicant (найдено ${applications.length})`
    );
  }

  const result = await prisma.postApplication.createMany({ data: applications });
  console.log(`Отклики: создано ${result.count}`);
  return result.count;
}

async function seedTasks(prisma: PrismaClient): Promise<number> {
  const applications = await prisma.postApplication.findMany({
    where: {
      message: { startsWith: SEED_APP_PREFIX },
      status: ApplicationStatus.ACCEPTED,
      task: null,
    },
    include: { post: true },
    take: COUNT,
    orderBy: { createdAt: 'asc' },
  });

  if (applications.length === 0) {
    const existingTasks = await prisma.task.count({
      where: {
        application: { message: { startsWith: SEED_APP_PREFIX } },
      },
    });
    console.log(`Задачи: уже есть ${existingTasks}, пропуск`);
    return 0;
  }

  let created = 0;

  for (const application of applications) {
    await prisma.task.create({
      data: {
        applicationId: application.id,
        postId: application.postId,
        ownerId: application.post.ownerId,
        executorId: application.applicantId,
        photoCount: application.post.photoCount,
        videoCount: application.post.videoCount,
        urgent: application.post.urgent,
      },
    });
    created++;
  }

  console.log(`Задачи: создано ${created}`);
  return created;
}

async function seedTaskComments(prisma: PrismaClient): Promise<number> {
  const existing = await prisma.taskComment.count({
    where: { content: { startsWith: SEED_COMMENT_PREFIX } },
  });

  if (existing >= COUNT) {
    console.log(`Комментарии к задачам: уже есть ${existing}, пропуск`);
    return 0;
  }

  const toCreate = COUNT - existing;
  const tasks = await prisma.task.findMany({
    where: {
      application: { message: { startsWith: SEED_APP_PREFIX } },
      comments: { none: { content: { startsWith: SEED_COMMENT_PREFIX } } },
    },
    select: { id: true, ownerId: true, executorId: true },
    take: toCreate,
    orderBy: { createdAt: 'asc' },
  });

  if (tasks.length === 0) {
    console.log('Комментарии к задачам: нечего создавать');
    return 0;
  }

  const comments = tasks.map((task, index) => ({
    taskId: task.id,
    authorId: index % 2 === 0 ? task.ownerId : task.executorId,
    content: `${SEED_COMMENT_PREFIX} #${existing + index + 1}`,
  }));

  const result = await prisma.taskComment.createMany({ data: comments });
  console.log(`Комментарии к задачам: создано ${result.count}`);
  return result.count;
}

async function seedConversationsAndMessages(
  prisma: PrismaClient,
  userIds: string[]
): Promise<{ conversations: number; messages: number }> {
  const existingMessages = await prisma.message.count({
    where: { content: { startsWith: SEED_MESSAGE_PREFIX } },
  });

  if (existingMessages >= COUNT) {
    console.log(`Диалоги/сообщения: уже есть ${existingMessages} сообщений, пропуск`);
    return { conversations: 0, messages: 0 };
  }

  const toCreate = COUNT - existingMessages;
  const pairs = uniquePairs(userIds, toCreate);

  if (pairs.length < toCreate) {
    throw new Error(
      `Недостаточно пользователей для ${toCreate} уникальных диалогов`
    );
  }

  let conversationsCreated = 0;
  let messagesCreated = 0;

  for (let i = 0; i < toCreate; i++) {
    const [userA, userB] = pairs[i];
    const messageNum = existingMessages + i + 1;

    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: userA }, { userId: userB }],
        },
        messages: {
          create: {
            senderId: userA,
            content: `${SEED_MESSAGE_PREFIX} #${messageNum}`,
          },
        },
      },
    });

    conversationsCreated++;
    messagesCreated++;
    void conversation;
  }

  console.log(`Диалоги: создано ${conversationsCreated}`);
  console.log(`Сообщения: создано ${messagesCreated}`);
  return { conversations: conversationsCreated, messages: messagesCreated };
}

async function seedDemoData() {
  const prisma = new PrismaClient();

  try {
    if (force) {
      await clearSeedData(prisma);
    }

    const userIds = await ensureUsers(prisma);
    console.log(`Пользователей в пуле: ${userIds.length}`);

    await seedApplications(prisma, userIds);
    await seedTasks(prisma);
    await seedTaskComments(prisma);
    await seedConversationsAndMessages(prisma, userIds);

    console.log('Seed завершён');
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoData().catch(error => {
  console.error('Не удалось создать demo-данные:', error);
  process.exit(1);
});
