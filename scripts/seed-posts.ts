import {
  PostAuthorType,
  PostContentType,
  PrismaClient,
  Role,
  TypeCooperation,
} from '@prisma/client';

const COUNT = 100;

function roleToPostAuthorType(role: Role): PostAuthorType {
  if (role === Role.CREATOR) {
    return PostAuthorType.CREATOR;
  }

  if (role === Role.COMPANY) {
    return PostAuthorType.COMPANY;
  }

  throw new Error(`Роль ${role} не может создавать посты`);
}

async function seedPosts() {
  const prisma = new PrismaClient();

  try {
    const owners = await prisma.user.findMany({
      where: { role: { in: [Role.CREATOR, Role.COMPANY] } },
      select: { id: true, role: true, email: true },
    });

    if (owners.length === 0) {
      throw new Error('В БД нет пользователей с ролью CREATOR или COMPANY');
    }

    const posts = Array.from({ length: COUNT }, (_, i) => {
      const owner = owners[i % owners.length];

      return {
        title: `Тестовый пост #${i + 1}`,
        ownerId: owner.id,
        type: roleToPostAuthorType(owner.role),
        typeCooperation: [TypeCooperation.ONE_TIME],
        contentType:
          i % 3 === 0 ? PostContentType.VIDEO : PostContentType.PHOTO,
        description: `Описание тестового поста ${i + 1}`,
        finalPrice: String(1000 + i * 100),
        categories: ['тест', 'seed'],
        keyWords: ['seed', `post-${i + 1}`],
        urgent: i % 10 === 0,
      };
    });

    const result = await prisma.post.createMany({ data: posts });

    console.log(`Создано постов: ${result.count}`);
    console.log(
      `Владельцы (${owners.length}): ${owners.map(o => o.email).join(', ')}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

seedPosts().catch(error => {
  console.error('Не удалось создать посты:', error);
  process.exit(1);
});
