import { Prisma } from '@prisma/client';

export function buildPostSearchWhere(q: string): Prisma.PostWhereInput {
  return {
    OR: [
      { title: { contains: q, mode: 'insensitive' } },
      {
        owner: {
          companyProfile: {
            companyName: { contains: q, mode: 'insensitive' },
          },
        },
      },
      {
        owner: {
          creatorProfile: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ],
  };
}

export const postListOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { urgent: 'desc' },
  { createdAt: 'desc' },
];
