import { ApiProperty } from '@nestjs/swagger';
import { MembershipRole, PrimeStatus, Role } from '@prisma/client';

export class ProfileSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ example: 'John Doe' })
  displayName: string;

  @ApiProperty({
    nullable: true,
    description:
      'ФИО менеджера аккаунта — для подписи COMPANY/CREATOR в profile switch',
  })
  actorName: string | null;

  @ApiProperty({ nullable: true })
  avatar: string | null;

  @ApiProperty({ enum: MembershipRole })
  membershipRole: MembershipRole;

  @ApiProperty({ format: 'uuid' })
  membershipId: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({
    description: 'Профиль проверен платформой (бейдж верификации)',
  })
  isVerified: boolean;

  @ApiProperty({
    description: 'Email профиля (User.email) подтверждён',
  })
  isEmailConfirmed: boolean;

  @ApiProperty({
    description: 'Дата добавления membership (ISO)',
  })
  createdAt: string;
}

export class AuthSessionUserResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'Account id (логин)' })
  accountId: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ enum: MembershipRole })
  membershipRole: MembershipRole;

  @ApiProperty({
    description: 'Профиль проверен платформой (бейдж верификации)',
  })
  isVerified: boolean;

  @ApiProperty({
    description: 'Email профиля (User.email) подтверждён',
  })
  isEmailConfirmed: boolean;

  @ApiProperty({
    description: 'Активна ли Prime-подписка текущего профиля (User)',
  })
  isPrime: boolean;

  @ApiProperty({ enum: PrimeStatus })
  primeStatus: PrimeStatus;

  @ApiProperty({
    nullable: true,
    description:
      'Дата окончания Prime (ISO). null — без срока или нет подписки',
  })
  primeExpiresAt: string | null;
}
