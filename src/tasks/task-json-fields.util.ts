import { Prisma } from '@prisma/client';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

type TaskJsonFieldsDto = Pick<
  CreateTaskDto & UpdateTaskDto,
  | 'location'
  | 'bloggerRequirements'
  | 'cooperationDetails'
  | 'brief'
  | 'deliverables'
>;

const TASK_JSON_FIELDS = [
  'location',
  'bloggerRequirements',
  'cooperationDetails',
  'brief',
  'deliverables',
] as const satisfies readonly (keyof TaskJsonFieldsDto)[];

export function taskJsonFieldsFromDto(
  dto: TaskJsonFieldsDto
): Prisma.TaskUpdateInput {
  const data: Prisma.TaskUpdateInput = {};

  for (const field of TASK_JSON_FIELDS) {
    if (dto[field] !== undefined) {
      data[field] =
        dto[field] === null
          ? Prisma.JsonNull
          : (dto[field] as unknown as Prisma.InputJsonValue);
    }
  }

  return data;
}
