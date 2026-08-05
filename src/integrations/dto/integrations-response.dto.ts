import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessengerProvider } from '@prisma/client';

export class IntegrationProviderStatusDto {
  @ApiProperty({ enum: MessengerProvider })
  provider: MessengerProvider;

  @ApiProperty({
    description: 'Бот настроен на сервере (есть token + username в env)',
  })
  configured: boolean;

  @ApiProperty({ description: 'Аккаунт пользователя привязан к боту' })
  connected: boolean;

  @ApiPropertyOptional({ nullable: true })
  username: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  linkedAt: string | null;
}

export class IntegrationsStatusResponseDto {
  @ApiProperty({ type: [IntegrationProviderStatusDto] })
  providers: IntegrationProviderStatusDto[];
}

export class IntegrationLinkResponseDto {
  @ApiProperty({ enum: MessengerProvider })
  provider: MessengerProvider;

  @ApiProperty({ description: 'Deep-link для открытия бота и привязки' })
  url: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
