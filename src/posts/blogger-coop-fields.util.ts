import {
  ContentStyle,
  UsageRights,
} from '@prisma/client';
import { BloggerRequirementsDto } from './dto/blogger-requirements.dto';
import { CooperationDetailsDto } from './dto/cooperation-details.dto';

export type BloggerCoopColumns = {
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagementRate: number | null;
  verifiedAccount: boolean | null;
  experienceWithAds: boolean | null;
  languages: string[];
  contentStyle: ContentStyle[];
  exclusivity: boolean | null;
  exclusivityDays: number | null;
  usageRights: UsageRights | null;
  usageDurationDays: number | null;
  requiresMarking: boolean | null;
  requiresContract: boolean | null;
  ndaRequired: boolean | null;
};

export type BloggerCoopWriteFields = Partial<{
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagementRate: number | null;
  verifiedAccount: boolean | null;
  experienceWithAds: boolean | null;
  languages: string[];
  contentStyle: ContentStyle[];
  exclusivity: boolean | null;
  exclusivityDays: number | null;
  usageRights: UsageRights | null;
  usageDurationDays: number | null;
  requiresMarking: boolean | null;
  requiresContract: boolean | null;
  ndaRequired: boolean | null;
}>;

const toNumberOrNull = (value: unknown): number | null => {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const toContentStyleArray = (value: unknown): ContentStyle[] => {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(Object.values(ContentStyle));
  return value.filter(
    (item): item is ContentStyle =>
      typeof item === 'string' && allowed.has(item as ContentStyle)
  );
};

const toUsageRightsOrNull = (value: unknown): UsageRights | null => {
  if (typeof value !== 'string') return null;
  const allowed = new Set(Object.values(UsageRights));
  return allowed.has(value as UsageRights) ? (value as UsageRights) : null;
};

/** Empty blogger object → clear columns; null → clear columns. */
export function bloggerRequirementsToColumns(
  value: BloggerRequirementsDto | null | undefined
): BloggerCoopWriteFields | undefined {
  if (value === undefined) return undefined;

  if (value === null) {
    return {
      minFollowers: null,
      maxFollowers: null,
      minEngagementRate: null,
      verifiedAccount: null,
      experienceWithAds: null,
      languages: [],
      contentStyle: [],
    };
  }

  const plain = value as Record<string, unknown>;

  return {
    minFollowers: toNumberOrNull(plain.minFollowers),
    maxFollowers: toNumberOrNull(plain.maxFollowers),
    minEngagementRate: toNumberOrNull(plain.minEngagementRate),
    verifiedAccount: toBooleanOrNull(plain.verifiedAccount),
    experienceWithAds: toBooleanOrNull(plain.experienceWithAds),
    languages: toStringArray(plain.languages),
    contentStyle: toContentStyleArray(plain.contentStyle),
  };
}

export function cooperationDetailsToColumns(
  value: CooperationDetailsDto | null | undefined
): BloggerCoopWriteFields | undefined {
  if (value === undefined) return undefined;

  if (value === null) {
    return {
      exclusivity: null,
      exclusivityDays: null,
      usageRights: null,
      usageDurationDays: null,
      requiresMarking: null,
      requiresContract: null,
      ndaRequired: null,
    };
  }

  const plain = value as Record<string, unknown>;

  return {
    exclusivity: toBooleanOrNull(plain.exclusivity),
    exclusivityDays: toNumberOrNull(plain.exclusivityDays),
    usageRights: toUsageRightsOrNull(plain.usageRights),
    usageDurationDays: toNumberOrNull(plain.usageDurationDays),
    requiresMarking: toBooleanOrNull(plain.requiresMarking),
    requiresContract: toBooleanOrNull(plain.requiresContract),
    ndaRequired: toBooleanOrNull(plain.ndaRequired),
  };
}

export function columnsToBloggerRequirements(
  row: Pick<
    BloggerCoopColumns,
    | 'minFollowers'
    | 'maxFollowers'
    | 'minEngagementRate'
    | 'verifiedAccount'
    | 'experienceWithAds'
    | 'languages'
    | 'contentStyle'
  >
): BloggerRequirementsDto | null {
  const hasValue =
    row.minFollowers != null ||
    row.maxFollowers != null ||
    row.minEngagementRate != null ||
    row.verifiedAccount != null ||
    row.experienceWithAds != null ||
    row.languages.length > 0 ||
    row.contentStyle.length > 0;

  if (!hasValue) return null;

  return {
    ...(row.minFollowers != null && { minFollowers: row.minFollowers }),
    ...(row.maxFollowers != null && { maxFollowers: row.maxFollowers }),
    ...(row.minEngagementRate != null && {
      minEngagementRate: row.minEngagementRate,
    }),
    ...(row.verifiedAccount != null && {
      verifiedAccount: row.verifiedAccount,
    }),
    ...(row.experienceWithAds != null && {
      experienceWithAds: row.experienceWithAds,
    }),
    ...(row.languages.length > 0 && { languages: row.languages }),
    ...(row.contentStyle.length > 0 && { contentStyle: row.contentStyle }),
  };
}

export function columnsToCooperationDetails(
  row: Pick<
    BloggerCoopColumns,
    | 'exclusivity'
    | 'exclusivityDays'
    | 'usageRights'
    | 'usageDurationDays'
    | 'requiresMarking'
    | 'requiresContract'
    | 'ndaRequired'
  >
): CooperationDetailsDto | null {
  const hasValue =
    row.exclusivity != null ||
    row.exclusivityDays != null ||
    row.usageRights != null ||
    row.usageDurationDays != null ||
    row.requiresMarking != null ||
    row.requiresContract != null ||
    row.ndaRequired != null;

  if (!hasValue) return null;

  return {
    ...(row.exclusivity != null && { exclusivity: row.exclusivity }),
    ...(row.exclusivityDays != null && {
      exclusivityDays: row.exclusivityDays,
    }),
    ...(row.usageRights != null && { usageRights: row.usageRights }),
    ...(row.usageDurationDays != null && {
      usageDurationDays: row.usageDurationDays,
    }),
    ...(row.requiresMarking != null && {
      requiresMarking: row.requiresMarking,
    }),
    ...(row.requiresContract != null && {
      requiresContract: row.requiresContract,
    }),
    ...(row.ndaRequired != null && { ndaRequired: row.ndaRequired }),
  };
}

/** Prisma create/update fragment from nested DTO fields. */
export function bloggerCoopFieldsFromDto(dto: {
  bloggerRequirements?: BloggerRequirementsDto | null;
  cooperationDetails?: CooperationDetailsDto | null;
}): BloggerCoopWriteFields {
  return {
    ...bloggerRequirementsToColumns(dto.bloggerRequirements),
    ...cooperationDetailsToColumns(dto.cooperationDetails),
  };
}
