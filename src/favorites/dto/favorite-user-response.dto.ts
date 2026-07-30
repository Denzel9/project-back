import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ContactItem } from '../../users/dto/contact-item.dto';
import { Person } from '../../users/dto/person.dto';

export class FavoriteUserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiPropertyOptional({ nullable: true })
  avatar: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio: string | null;

  @ApiProperty({
    description: 'Профиль проверен платформой (бейдж верификации)',
  })
  isVerified: boolean;

  @ApiProperty({
    description: 'Сколько пользователей добавили этого пользователя в избранное',
    example: 12,
  })
  followers: number;

  @ApiProperty({
    description: 'Кол-во завершённых задач (как владелец или исполнитель)',
    example: 5,
  })
  completedTasksCount: number;

  @ApiPropertyOptional({ nullable: true })
  location: string | null;

  @ApiPropertyOptional({ nullable: true })
  aboutMe: string | null;

  @ApiPropertyOptional({ nullable: true })
  banner: string | null;

  @ApiPropertyOptional({ description: 'Только для CREATOR' })
  name?: string;

  @ApiPropertyOptional({ description: 'Только для CREATOR' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Только для COMPANY' })
  companyName?: string;

  @ApiPropertyOptional({ nullable: true, type: 'array' })
  contacts?: ContactItem[] | null;

  @ApiPropertyOptional({ nullable: true })
  person?: Person | null;
}
