import { ApiProperty } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import { IsEmail, IsEnum, IsUUID } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({
    example: 'manager@example.com',
    description: 'Email приглашённого (должен совпасть с Account при accept)',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    format: 'uuid',
    description: 'userId существующего профиля, к которому даётся доступ',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    enum: [MembershipRole.ADMIN, MembershipRole.EDITOR, MembershipRole.VIEWER],
    description:
      'ADMIN — полный доступ + invite; EDITOR — редактирование; VIEWER — только чтение',
  })
  @IsEnum(MembershipRole)
  role: MembershipRole;
}
