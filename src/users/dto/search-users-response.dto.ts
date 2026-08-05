import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserSearchItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: [Role.CREATOR, Role.COMPANY] })
  role: Role;

  @ApiProperty({ nullable: true, type: String })
  avatar: string | null;

  @ApiProperty({
    description: 'ФИО креатора или название компании',
  })
  displayName: string;
}

export class SearchUsersResponseDto {
  @ApiProperty({ type: [UserSearchItemDto] })
  items: UserSearchItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
