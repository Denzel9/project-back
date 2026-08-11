import { ApiProperty } from '@nestjs/swagger';
import { InviteKind, MembershipRole } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsUUID } from 'class-validator';

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
    enum: [MembershipRole.ADMIN],
    description: 'ADMIN — полный доступ + invite (не OWNER)',
  })
  @IsIn([MembershipRole.ADMIN])
  role: MembershipRole;

  @ApiProperty({
    enum: InviteKind,
    description:
      'TEAM — мультиаккаунт (менеджер в команду); CROSS — кросс-аккаунт (COMPANY/CREATOR)',
  })
  @IsEnum(InviteKind)
  kind: InviteKind;
}
