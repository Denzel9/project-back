import { Prisma } from '@prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { mapBudgetFromApi } from './post-json.util';
import { bloggerCoopFieldsFromDto } from './blogger-coop-fields.util';

type PostJsonWriteFields = Pick<
  Prisma.PostCreateInput,
  | 'budget'
  | 'deadline'
  | 'workFormat'
  | 'employmentType'
  | 'location'
  | 'brief'
  | 'deliverables'
> &
  ReturnType<typeof bloggerCoopFieldsFromDto>;

export function postJsonFieldsFromDto(
  dto: CreatePostDto | UpdatePostDto
): PostJsonWriteFields {
  const data: PostJsonWriteFields = {
    ...bloggerCoopFieldsFromDto(dto),
  };

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

  if (dto.employmentType !== undefined) {
    data.employmentType = dto.employmentType;
  }

  if (dto.location !== undefined) {
    data.location = dto.location as unknown as Prisma.InputJsonValue;
  }

  if (dto.brief !== undefined) {
    data.brief = dto.brief as unknown as Prisma.InputJsonValue;
  }

  if (dto.deliverables !== undefined) {
    data.deliverables = dto.deliverables as unknown as Prisma.InputJsonValue;
  }

  return data;
}
