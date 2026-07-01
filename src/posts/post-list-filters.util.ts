import { PaymentTerms, Prisma } from '@prisma/client';
import { buildCalendarDayFilter } from '../common/date/calendar-day-filter';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';

function paymentTermsBudgetFilters(
  paymentTerms: ListPostsQueryDto['paymentTerms']
): Prisma.PostWhereInput[] {
  if (paymentTerms === undefined) {
    return [];
  }

  if (paymentTerms === '50_50') {
    return [
      {
        OR: [
          {
            budget: {
              path: ['paymentTerms'],
              equals: PaymentTerms.FIFTY_FIFTY,
            },
          },
          {
            budget: {
              path: ['paymentTerms'],
              equals: '50_50',
            },
          },
        ],
      },
    ];
  }

  return [
    {
      budget: {
        path: ['paymentTerms'],
        equals: paymentTerms,
      },
    },
  ];
}

function jsonPathEquals(
  field: keyof Prisma.PostWhereInput,
  path: string[],
  value: string | number | boolean
): Prisma.PostWhereInput {
  return {
    [field]: {
      path,
      equals: value,
    },
  } as Prisma.PostWhereInput;
}

function jsonPathStringContains(
  field: keyof Prisma.PostWhereInput,
  path: string[],
  value: string
): Prisma.PostWhereInput {
  return {
    [field]: {
      path,
      string_contains: value,
    },
  } as Prisma.PostWhereInput;
}

function jsonPathArrayContains(
  field: keyof Prisma.PostWhereInput,
  path: string[],
  value: string
): Prisma.PostWhereInput {
  return {
    [field]: {
      path,
      array_contains: value,
    },
  } as Prisma.PostWhereInput;
}

export function buildPostFieldFilters(
  query: ListPostsQueryDto
): Prisma.PostWhereInput {
  const andFilters: Prisma.PostWhereInput[] = [];

  if (query.title !== undefined) {
    andFilters.push({
      title: { contains: query.title, mode: 'insensitive' },
    });
  }

  if (query.urgent !== undefined) {
    andFilters.push({ urgent: query.urgent });
  }

  if (query.chips !== undefined) {
    andFilters.push({ chips: { hasSome: query.chips } });
  }

  if (query.categories !== undefined) {
    andFilters.push({ categories: { hasSome: query.categories } });
  }

  if (query.platforms !== undefined) {
    andFilters.push({ platforms: { hasSome: query.platforms } });
  }

  if (query.placementFormats !== undefined) {
    andFilters.push({ placementFormats: { hasSome: query.placementFormats } });
  }

  if (query.niche !== undefined) {
    andFilters.push({ niche: { hasSome: query.niche } });
  }

  if (query.tags !== undefined) {
    andFilters.push({ tags: { hasSome: query.tags } });
  }

  if (query.workFormat !== undefined) {
    andFilters.push({ workFormat: query.workFormat });
  }

  const createdAtFilter = buildCalendarDayFilter(query.createdDate);
  if (createdAtFilter) {
    andFilters.push({ createdAt: createdAtFilter });
  }

  const deadlineFilter = buildCalendarDayFilter(query.deadlineDate);
  if (deadlineFilter) {
    andFilters.push({ deadline: deadlineFilter });
  }

  if (query.budgetType !== undefined) {
    andFilters.push(jsonPathEquals('budget', ['type'], query.budgetType));
  }

  if (query.budgetCurrency !== undefined) {
    andFilters.push(
      jsonPathEquals('budget', ['currency'], query.budgetCurrency)
    );
  }

  andFilters.push(...paymentTermsBudgetFilters(query.paymentTerms));

  if (query.locationCity !== undefined) {
    andFilters.push(
      jsonPathStringContains('location', ['city'], query.locationCity)
    );
  }

  if (query.locationCountry !== undefined) {
    andFilters.push(
      jsonPathStringContains('location', ['country'], query.locationCountry)
    );
  }

  if (query.shootingRequired !== undefined) {
    andFilters.push(
      jsonPathEquals('location', ['shootingRequired'], query.shootingRequired)
    );
  }

  if (query.minFollowers !== undefined) {
    andFilters.push(
      jsonPathEquals('bloggerRequirements', ['minFollowers'], query.minFollowers)
    );
  }

  if (query.maxFollowers !== undefined) {
    andFilters.push(
      jsonPathEquals('bloggerRequirements', ['maxFollowers'], query.maxFollowers)
    );
  }

  if (query.minEngagementRate !== undefined) {
    andFilters.push(
      jsonPathEquals(
        'bloggerRequirements',
        ['minEngagementRate'],
        query.minEngagementRate
      )
    );
  }

  if (query.verifiedAccount !== undefined) {
    andFilters.push(
      jsonPathEquals(
        'bloggerRequirements',
        ['verifiedAccount'],
        query.verifiedAccount
      )
    );
  }

  if (query.experienceWithAds !== undefined) {
    andFilters.push(
      jsonPathEquals(
        'bloggerRequirements',
        ['experienceWithAds'],
        query.experienceWithAds
      )
    );
  }

  if (query.contentStyle !== undefined) {
    andFilters.push({
      OR: query.contentStyle.map(style =>
        jsonPathArrayContains('bloggerRequirements', ['contentStyle'], style)
      ),
    });
  }

  if (query.exclusivity !== undefined) {
    andFilters.push(
      jsonPathEquals('cooperationDetails', ['exclusivity'], query.exclusivity)
    );
  }

  if (query.exclusivityDays !== undefined) {
    andFilters.push(
      jsonPathEquals(
        'cooperationDetails',
        ['exclusivityDays'],
        query.exclusivityDays
      )
    );
  }

  if (query.usageRights !== undefined) {
    andFilters.push(
      jsonPathEquals('cooperationDetails', ['usageRights'], query.usageRights)
    );
  }

  if (query.usageDurationDays !== undefined) {
    andFilters.push(
      jsonPathEquals(
        'cooperationDetails',
        ['usageDurationDays'],
        query.usageDurationDays
      )
    );
  }

  if (query.requiresMarking !== undefined) {
    andFilters.push(
      jsonPathEquals(
        'cooperationDetails',
        ['requiresMarking'],
        query.requiresMarking
      )
    );
  }

  if (query.requiresContract !== undefined) {
    andFilters.push(
      jsonPathEquals(
        'cooperationDetails',
        ['requiresContract'],
        query.requiresContract
      )
    );
  }

  if (query.ndaRequired !== undefined) {
    andFilters.push(
      jsonPathEquals('cooperationDetails', ['ndaRequired'], query.ndaRequired)
    );
  }

  if (query.briefHashtag !== undefined) {
    andFilters.push(
      jsonPathArrayContains('brief', ['hashtags'], query.briefHashtag)
    );
  }

  if (query.briefMention !== undefined) {
    andFilters.push(
      jsonPathArrayContains('brief', ['mentions'], query.briefMention)
    );
  }

  if (
    query.deliverablePlatform !== undefined ||
    query.deliverableFormat !== undefined
  ) {
    const deliverable: Record<string, string> = {};

    if (query.deliverablePlatform !== undefined) {
      deliverable.platform = query.deliverablePlatform;
    }

    if (query.deliverableFormat !== undefined) {
      deliverable.format = query.deliverableFormat;
    }

    andFilters.push({
      deliverables: {
        array_contains: deliverable,
      },
    });
  }

  if (andFilters.length === 0) {
    return {};
  }

  if (andFilters.length === 1) {
    return andFilters[0];
  }

  return { AND: andFilters };
}
