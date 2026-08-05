import { Prisma } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { bloggerCoopFieldsFromDto } from '../posts/blogger-coop-fields.util';

type TaskJsonFieldsDto = Pick<
  CreateTaskDto & UpdateTaskDto,
  'location' | 'bloggerRequirements' | 'cooperationDetails' | 'brief' | 'deliverables'
>;

const TASK_REMAINING_JSON_FIELDS = [
  'location',
  'brief',
  'deliverables',
] as const satisfies readonly (keyof TaskJsonFieldsDto)[];

/** JSON + flat blogger/coop fields for task create and update. */
export type TaskJsonWriteFields = Partial<
  Record<
    (typeof TASK_REMAINING_JSON_FIELDS)[number],
    Prisma.InputJsonValue | typeof Prisma.JsonNull
  >
> &
  ReturnType<typeof bloggerCoopFieldsFromDto>;

export function taskJsonFieldsFromDto(
  dto: TaskJsonFieldsDto
): TaskJsonWriteFields {
  const data: TaskJsonWriteFields = {
    ...bloggerCoopFieldsFromDto(dto),
  };

  for (const field of TASK_REMAINING_JSON_FIELDS) {
    if (dto[field] !== undefined) {
      data[field] =
        dto[field] === null
          ? Prisma.JsonNull
          : (dto[field] as unknown as Prisma.InputJsonValue);
    }
  }

  return data;
}
