import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ListApplicationPartnersQueryDto } from './dto/list-application-partners-query.dto';
import { ListTaskPartnersQueryDto } from './dto/list-task-partners-query.dto';
import { PartnerSort } from './dto/partner-sort.enum';
import { PartnerSummaryDto } from './dto/partner-summary.dto';
import {
  buildApplicationPartnerFilters,
  buildCompanyNameSearch,
  buildCreatorNameSearch,
  buildPostTitleSearch,
  buildTaskPartnerTaskFilters,
} from './partner-filters.util';
import {
  companyNameOrderBy,
  creatorNameOrderBy,
  mapPartnerSummary,
  partnerUserInclude,
  PartnerUser,
} from './partner-profile.util';

type PartnerStats = Map<string, { interactionsCount: number; lastInteractionAt: Date }>;

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  listTaskExecutors(user: AuthUser, query: ListTaskPartnersQueryDto) {
    const taskFilters = buildTaskPartnerTaskFilters(query);

    const taskWhere: Prisma.TaskWhereInput = {
      ownerId: user.userId,
      executorId: { not: null },
      ...taskFilters,
      ...(query.userId !== undefined && { executorId: query.userId }),
    };

    return this.listTaskPartners({
      query,
      groupByField: 'executorId',
      taskWhere,
      partnerRole: Role.CREATOR,
      searchPartner: buildCreatorNameSearch,
    });
  }

  listTaskCustomers(user: AuthUser, query: ListTaskPartnersQueryDto) {
    const taskFilters = buildTaskPartnerTaskFilters(query);

    const taskWhere: Prisma.TaskWhereInput = {
      executorId: user.userId,
      ...taskFilters,
      ...(query.userId !== undefined && { ownerId: query.userId }),
    };

    return this.listTaskPartners({
      query,
      groupByField: 'ownerId',
      taskWhere,
      partnerRole: Role.COMPANY,
      searchPartner: buildCompanyNameSearch,
    });
  }

  listApplicationApplicants(
    user: AuthUser,
    query: ListApplicationPartnersQueryDto
  ) {
    const applicationFilters = buildApplicationPartnerFilters(query);

    const applicationWhere: Prisma.PostApplicationWhereInput = {
      ...applicationFilters,
      post: {
        ownerId: user.userId,
        ...(query.postId !== undefined && { id: query.postId }),
      },
      ...(query.userId !== undefined && { applicantId: query.userId }),
      ...(query.q !== undefined && {
        OR: [
          {
            applicant: buildCreatorNameSearch(query.q),
            post: { ownerId: user.userId },
          },
          {
            post: {
              ownerId: user.userId,
              ...(query.postId !== undefined && { id: query.postId }),
              ...buildPostTitleSearch(query.q),
            },
          },
        ],
      }),
    };

    return this.listApplicationPartners({
      query,
      groupByField: 'applicantId',
      applicationWhere,
      partnerRole: Role.CREATOR,
      searchPartner: buildCreatorNameSearch,
    });
  }

  listApplicationCompanies(
    user: AuthUser,
    query: ListApplicationPartnersQueryDto
  ) {
    const applicationFilters = buildApplicationPartnerFilters(query);

    const postFilter: Prisma.PostWhereInput = {
      ...(query.userId !== undefined && { ownerId: query.userId }),
    };

    const applicationWhere: Prisma.PostApplicationWhereInput = {
      applicantId: user.userId,
      ...applicationFilters,
      ...(query.postId !== undefined && { postId: query.postId }),
      ...(query.q === undefined &&
        Object.keys(postFilter).length > 0 && { post: postFilter }),
      ...(query.q !== undefined && {
        OR: [
          { post: { ...postFilter, ...buildPostTitleSearch(query.q) } },
          {
            post: {
              ...postFilter,
              owner: buildCompanyNameSearch(query.q),
            },
          },
        ],
      }),
    };

    return this.listApplicationCompaniesAggregated(query, applicationWhere);
  }

  private async listTaskPartners(params: {
    query: ListTaskPartnersQueryDto;
    groupByField: 'executorId' | 'ownerId';
    taskWhere: Prisma.TaskWhereInput;
    partnerRole: Role;
    searchPartner: (q: string) => Prisma.UserWhereInput;
  }) {
    const page = params.query.page ?? 1;
    const limit = params.query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sort = params.query.sort ?? PartnerSort.RECENT;

    if (sort === PartnerSort.NAME) {
      return this.listTaskPartnersByName({
        ...params,
        page,
        limit,
        skip,
      });
    }

    return this.listTaskPartnersByRecent({
      ...params,
      page,
      limit,
      skip,
    });
  }

  private async listTaskPartnersByRecent(params: {
    query: ListTaskPartnersQueryDto;
    groupByField: 'executorId' | 'ownerId';
    taskWhere: Prisma.TaskWhereInput;
    partnerRole: Role;
    searchPartner: (q: string) => Prisma.UserWhereInput;
    page: number;
    limit: number;
    skip: number;
  }) {
    const groups = await this.prisma.task.groupBy({
      by: [params.groupByField],
      where: {
        ...params.taskWhere,
        ...(params.query.q !== undefined && {
          ...(params.groupByField === 'executorId'
            ? { executor: params.searchPartner(params.query.q) }
            : { owner: params.searchPartner(params.query.q) }),
        }),
      },
      _count: { _all: true },
      _max: { updatedAt: true },
    });

    const partnerGroups = groups
      .filter(
        (
          group
        ): group is typeof group & {
          executorId: string;
        } | typeof group & { ownerId: string } =>
          params.groupByField === 'executorId'
            ? group.executorId !== null
            : true
      )
      .map(group => ({
        partnerId:
          params.groupByField === 'executorId'
            ? group.executorId!
            : group.ownerId,
        interactionsCount: group._count._all,
        lastInteractionAt: group._max.updatedAt ?? new Date(0),
      }))
      .sort(
        (left, right) =>
          right.lastInteractionAt.getTime() - left.lastInteractionAt.getTime()
      );

    const total = partnerGroups.length;
    const pageGroups = partnerGroups.slice(params.skip, params.skip + params.limit);
    const partnerIds = pageGroups.map(group => group.partnerId);

    if (partnerIds.length === 0) {
      return { items: [], total, page: params.page, limit: params.limit };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: partnerIds }, role: params.partnerRole },
      include: partnerUserInclude,
    });

    const usersById = new Map(users.map(user => [user.id, user]));
    const stats = new Map(
      pageGroups.map(group => [
        group.partnerId,
        {
          interactionsCount: group.interactionsCount,
          lastInteractionAt: group.lastInteractionAt,
        },
      ])
    );

    return {
      items: partnerIds
        .map(id => this.mapPartnerIfPresent(usersById, stats, id))
        .filter((item): item is PartnerSummaryDto => item !== null),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  private async listTaskPartnersByName(params: {
    query: ListTaskPartnersQueryDto;
    groupByField: 'executorId' | 'ownerId';
    taskWhere: Prisma.TaskWhereInput;
    partnerRole: Role;
    searchPartner: (q: string) => Prisma.UserWhereInput;
    page: number;
    limit: number;
    skip: number;
  }) {
    const relationFilter =
      params.groupByField === 'executorId'
        ? {
            executedTasks: {
              some: params.taskWhere,
            },
          }
        : {
            ownedTasks: {
              some: params.taskWhere,
            },
          };

    const where: Prisma.UserWhereInput = {
      role: params.partnerRole,
      ...(params.query.userId !== undefined && { id: params.query.userId }),
      ...(params.query.q !== undefined && params.searchPartner(params.query.q)),
      ...relationFilter,
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: partnerUserInclude,
        orderBy:
          params.partnerRole === Role.CREATOR
            ? creatorNameOrderBy()
            : companyNameOrderBy(),
        skip: params.skip,
        take: params.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const stats = await this.getTaskPartnerStats(
      params.groupByField,
      users.map(user => user.id),
      params.taskWhere
    );

    return {
      items: users.map(user =>
        mapPartnerSummary(user, this.requireStats(stats, user.id))
      ),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  private async listApplicationPartners(params: {
    query: ListApplicationPartnersQueryDto;
    groupByField: 'applicantId';
    applicationWhere: Prisma.PostApplicationWhereInput;
    partnerRole: Role;
    searchPartner: (q: string) => Prisma.UserWhereInput;
  }) {
    const page = params.query.page ?? 1;
    const limit = params.query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sort = params.query.sort ?? PartnerSort.RECENT;

    if (sort === PartnerSort.NAME) {
      return this.listApplicationPartnersByName({
        ...params,
        page,
        limit,
        skip,
      });
    }

    const groups = await this.prisma.postApplication.groupBy({
      by: [params.groupByField],
      where: params.applicationWhere,
      _count: { _all: true },
      _max: { updatedAt: true },
    });

    const partnerGroups = groups
      .map(group => ({
        partnerId: group.applicantId,
        interactionsCount: group._count._all,
        lastInteractionAt: group._max.updatedAt ?? new Date(0),
      }))
      .sort(
        (left, right) =>
          right.lastInteractionAt.getTime() - left.lastInteractionAt.getTime()
      );

    const total = partnerGroups.length;
    const pageGroups = partnerGroups.slice(skip, skip + limit);
    const partnerIds = pageGroups.map(group => group.partnerId);

    if (partnerIds.length === 0) {
      return { items: [], total, page, limit };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: partnerIds }, role: params.partnerRole },
      include: partnerUserInclude,
    });

    const usersById = new Map(users.map(user => [user.id, user]));
    const stats = new Map(
      pageGroups.map(group => [
        group.partnerId,
        {
          interactionsCount: group.interactionsCount,
          lastInteractionAt: group.lastInteractionAt,
        },
      ])
    );

    return {
      items: partnerIds
        .map(id => this.mapPartnerIfPresent(usersById, stats, id))
        .filter((item): item is PartnerSummaryDto => item !== null),
      total,
      page,
      limit,
    };
  }

  private async listApplicationPartnersByName(params: {
    query: ListApplicationPartnersQueryDto;
    applicationWhere: Prisma.PostApplicationWhereInput;
    partnerRole: Role;
    searchPartner: (q: string) => Prisma.UserWhereInput;
    page: number;
    limit: number;
    skip: number;
  }) {
    const where: Prisma.UserWhereInput = {
      role: params.partnerRole,
      ...(params.query.userId !== undefined && { id: params.query.userId }),
      ...(params.query.q !== undefined && params.searchPartner(params.query.q)),
      applications: {
        some: params.applicationWhere,
      },
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: partnerUserInclude,
        orderBy: creatorNameOrderBy(),
        skip: params.skip,
        take: params.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const stats = await this.getApplicationApplicantStats(
      users.map(user => user.id),
      params.applicationWhere
    );

    return {
      items: users.map(user =>
        mapPartnerSummary(user, this.requireStats(stats, user.id))
      ),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  private async listApplicationCompaniesAggregated(
    query: ListApplicationPartnersQueryDto,
    applicationWhere: Prisma.PostApplicationWhereInput
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sort = query.sort ?? PartnerSort.RECENT;

    const applications = await this.prisma.postApplication.findMany({
      where: applicationWhere,
      select: {
        updatedAt: true,
        post: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    const aggregated = new Map<
      string,
      { interactionsCount: number; lastInteractionAt: Date }
    >();

    for (const application of applications) {
      const ownerId = application.post.ownerId;
      const current = aggregated.get(ownerId);

      if (!current) {
        aggregated.set(ownerId, {
          interactionsCount: 1,
          lastInteractionAt: application.updatedAt,
        });
        continue;
      }

      current.interactionsCount += 1;

      if (application.updatedAt > current.lastInteractionAt) {
        current.lastInteractionAt = application.updatedAt;
      }
    }

    let partnerGroups = [...aggregated.entries()].map(([partnerId, stats]) => ({
      partnerId,
      ...stats,
    }));

    if (sort === PartnerSort.RECENT) {
      partnerGroups.sort(
        (left, right) =>
          right.lastInteractionAt.getTime() - left.lastInteractionAt.getTime()
      );
    } else {
      const companies = await this.prisma.user.findMany({
        where: { id: { in: partnerGroups.map(group => group.partnerId) } },
        include: partnerUserInclude,
      });
      const names = new Map(
        companies.map(company => [
          company.id,
          company.companyProfile?.companyName ?? '',
        ])
      );

      partnerGroups.sort((left, right) =>
        (names.get(left.partnerId) ?? '').localeCompare(
          names.get(right.partnerId) ?? '',
          'ru'
        )
      );
    }

    const total = partnerGroups.length;
    const pageGroups = partnerGroups.slice(skip, skip + limit);
    const partnerIds = pageGroups.map(group => group.partnerId);

    if (partnerIds.length === 0) {
      return { items: [], total, page, limit };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: partnerIds }, role: Role.COMPANY },
      include: partnerUserInclude,
    });

    const usersById = new Map(users.map(user => [user.id, user]));
    const stats = new Map(
      pageGroups.map(group => [
        group.partnerId,
        {
          interactionsCount: group.interactionsCount,
          lastInteractionAt: group.lastInteractionAt,
        },
      ])
    );

    return {
      items: partnerIds
        .map(id => this.mapPartnerIfPresent(usersById, stats, id))
        .filter((item): item is PartnerSummaryDto => item !== null),
      total,
      page,
      limit,
    };
  }

  private async getTaskPartnerStats(
    groupByField: 'executorId' | 'ownerId',
    partnerIds: string[],
    taskWhere: Prisma.TaskWhereInput
  ): Promise<PartnerStats> {
    if (partnerIds.length === 0) {
      return new Map();
    }

    const groups = await this.prisma.task.groupBy({
      by: [groupByField],
      where: {
        ...taskWhere,
        ...(groupByField === 'executorId'
          ? { executorId: { in: partnerIds } }
          : { ownerId: { in: partnerIds } }),
      },
      _count: { _all: true },
      _max: { updatedAt: true },
    });

    return new Map(
      groups.map(group => [
        groupByField === 'executorId' ? group.executorId! : group.ownerId,
        {
          interactionsCount: group._count._all,
          lastInteractionAt: group._max.updatedAt ?? new Date(0),
        },
      ])
    );
  }

  private async getApplicationApplicantStats(
    applicantIds: string[],
    applicationWhere: Prisma.PostApplicationWhereInput
  ): Promise<PartnerStats> {
    if (applicantIds.length === 0) {
      return new Map();
    }

    const groups = await this.prisma.postApplication.groupBy({
      by: ['applicantId'],
      where: {
        ...applicationWhere,
        applicantId: { in: applicantIds },
      },
      _count: { _all: true },
      _max: { updatedAt: true },
    });

    return new Map(
      groups.map(group => [
        group.applicantId,
        {
          interactionsCount: group._count._all,
          lastInteractionAt: group._max.updatedAt ?? new Date(0),
        },
      ])
    );
  }

  private mapPartnerIfPresent(
    usersById: Map<string, PartnerUser>,
    stats: PartnerStats,
    partnerId: string
  ): PartnerSummaryDto | null {
    const user = usersById.get(partnerId);
    const partnerStats = stats.get(partnerId);

    if (!user || !partnerStats) {
      return null;
    }

    return mapPartnerSummary(user, partnerStats);
  }

  private requireStats(stats: PartnerStats, partnerId: string) {
    return (
      stats.get(partnerId) ?? {
        interactionsCount: 0,
        lastInteractionAt: new Date(0),
      }
    );
  }
}
