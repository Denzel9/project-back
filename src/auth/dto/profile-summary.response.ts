import { ApiProperty } from '@nestjs/swagger';
import { MembershipRole, Role } from '@prisma/client';

export class ProfileSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ example: 'John Doe' })
  displayName: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;

  @ApiProperty({ enum: MembershipRole })
  membershipRole: MembershipRole;

  @ApiProperty({ format: 'uuid' })
  membershipId: string;

  @ApiProperty()
  isActive: boolean;
}

export class AuthSessionUserResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ enum: MembershipRole })
  membershipRole: MembershipRole;
}
