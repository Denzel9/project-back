import { Prisma } from '@prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { mapBudgetFromApi } from './post-json.util';

type PostJsonWriteFields = Pick<
  Prisma.PostCreateInput,
  | 'budget'
  | 'deadline'
  | 'workFormat'
  | 'location'
  | 'bloggerRequirements'
  | 'cooperationDetails'
  | 'brief'
  | 'deliverables'
>;

export function postJsonFieldsFromDto(
  dto: CreatePostDto | UpdatePostDto
): PostJsonWriteFields {
  const data: PostJsonWriteFields = {};

  if (dto.budget !== undefined) {
    data.budget = mapBudgetFromApi(
      dto.budget as unknown as Record<string, unknown>
    ) as Prisma.InputJsonValue;
  }

  if (dto.deadline !== undefined) {
    data.deadline = new Date(dto.deadline);
  }

  if (dto.workFormat !== undefined) {
    data.workFormat = dto.workFormat;
  }

  if (dto.location !== undefined) {
    data.location = dto.location as unknown as Prisma.InputJsonValue;
  }

  if (dto.bloggerRequirements !== undefined) {
    data.bloggerRequirements =
      dto.bloggerRequirements as unknown as Prisma.InputJsonValue;
  }

  if (dto.cooperationDetails !== undefined) {
    data.cooperationDetails =
      dto.cooperationDetails as unknown as Prisma.InputJsonValue;
  }

  if (dto.brief !== undefined) {
    data.brief = dto.brief as unknown as Prisma.InputJsonValue;
  }

  if (dto.deliverables !== undefined) {
    data.deliverables = dto.deliverables as unknown as Prisma.InputJsonValue;
  }

  return data;
}
