import {
  BudgetType,
  ContentStyle,
  PaymentTerms,
  PlacementFormat,
  Platform,
  PostCurrency,
  Prisma,
  UsageRights,
  WorkFormat,
} from '@prisma/client';

const PLATFORMS = Object.values(Platform);
const PLACEMENT_FORMATS = Object.values(PlacementFormat);
const WORK_FORMATS = Object.values(WorkFormat);
const BUDGET_TYPES = Object.values(BudgetType);
const CURRENCIES = Object.values(PostCurrency);
const PAYMENT_TERMS = Object.values(PaymentTerms);
const CONTENT_STYLES = Object.values(ContentStyle);
const USAGE_RIGHTS = Object.values(UsageRights);

const NICHES = [
  'beauty',
  'fashion',
  'food',
  'travel',
  'tech',
  'fitness',
  'gaming',
  'education',
];

const TAGS = [
  'collab',
  'sponsored',
  'brand',
  'campaign',
  'ugc',
  'influencer',
];

const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск'];
const COUNTRIES = ['Россия', 'Казахстан', 'Беларусь'];
const LANGUAGES = ['ru', 'en', 'kz'];

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickMany<T>(items: T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomFutureDate(daysAheadMin = 7, daysAheadMax = 90): Date {
  const days = randomInt(daysAheadMin, daysAheadMax);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function buildRandomPostFields() {
  const platforms = pickMany(PLATFORMS, 1, 3);
  const placementFormats = pickMany(PLACEMENT_FORMATS, 1, 2);
  const budgetType = pickOne(BUDGET_TYPES);
  const amount = randomInt(5_000, 150_000);

  const budget: Prisma.InputJsonValue = {
    type: budgetType,
    currency: pickOne(CURRENCIES),
    paymentTerms: pickOne(PAYMENT_TERMS),
    ...(budgetType === BudgetType.FIXED && { amount }),
    ...(budgetType === BudgetType.RANGE && {
      minAmount: amount,
      maxAmount: amount + randomInt(5_000, 50_000),
    }),
    ...(budgetType === BudgetType.BARTER && {
      barterDescription: 'Обмен на продукцию бренда',
    }),
  };

  const deliverables = platforms.map(platform => ({
    platform,
    format: pickOne(placementFormats),
    count: randomInt(1, 5),
    ...(Math.random() > 0.5 && { durationSec: randomInt(15, 120) }),
  }));

  return {
    platforms,
    placementFormats,
    niche: pickMany(NICHES, 1, 3),
    tags: pickMany(TAGS, 1, 4),
    budget,
    deadline: randomFutureDate(),
    workFormat: pickOne(WORK_FORMATS),
    location: {
      city: pickOne(CITIES),
      country: pickOne(COUNTRIES),
      shootingRequired: Math.random() > 0.5,
    },
    bloggerRequirements: {
      minFollowers: randomInt(1_000, 50_000),
      maxFollowers: randomInt(50_000, 500_000),
      minEngagementRate: randomInt(1, 10),
      verifiedAccount: Math.random() > 0.6,
      experienceWithAds: Math.random() > 0.4,
      languages: pickMany(LANGUAGES, 1, 2),
      contentStyle: pickMany(CONTENT_STYLES, 1, 3),
    },
    cooperationDetails: {
      exclusivity: Math.random() > 0.5,
      exclusivityDays: randomInt(7, 30),
      usageRights: pickOne(USAGE_RIGHTS),
      usageDurationDays: randomInt(30, 365),
      requiresMarking: Math.random() > 0.3,
      requiresContract: Math.random() > 0.4,
      ndaRequired: Math.random() > 0.7,
    },
    brief: {
      taskDescription: 'Создать нативный контент с упоминанием продукта',
      references: ['https://example.com/reference'],
      hashtags: ['#brand', '#collab'],
      mentions: ['@brand'],
      cta: 'Перейти по ссылке в профиле',
      dosAndDonts: 'Без политики и конкурентов',
    },
    deliverables,
  };
}
