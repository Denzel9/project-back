import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import {
  PrimeSubscriptionService,
  type PrimeSubscriptionView,
} from './prime-subscription.service';

@ApiTags('billing')
@ApiCookieAuth('access-token')
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly primeSubscriptionService: PrimeSubscriptionService
  ) {}

  @Get('subscription')
  @ApiOperation({
    summary: 'Статус Prime-подписки активного профиля',
    description:
      'Подписка привязана к User (профилю), не к Account. ' +
      '`isPrime` — вычисляемый флаг активности текущего профиля.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  async getSubscription(@CurrentUser() user: AuthUser) {
    const subscription = await this.primeSubscriptionService.getSubscription(
      user.userId
    );
    return this.toResponse(subscription);
  }

  @Post('subscription/activate')
  @ApiOperation({
    summary: 'Stub: активировать Prime для текущего профиля',
    description:
      'Временный эндпоинт без оплаты. Доступен OWNER/ADMIN. ' +
      'Активирует Prime только для активного User-профиля.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiForbiddenResponse({ description: 'Недостаточно прав' })
  async activate(
    @CurrentUser() user: AuthUser,
    @Body() dto: ActivateSubscriptionDto
  ) {
    const subscription = await this.primeSubscriptionService.activateStub(
      user.accountId,
      user.userId,
      { days: dto.days }
    );
    return this.toResponse(subscription);
  }

  @Post('subscription/deactivate')
  @ApiOperation({
    summary: 'Stub: отключить Prime у текущего профиля',
    description:
      'Временный эндпоинт без оплаты. Ставит статус CANCELED у активного профиля. ' +
      'Доступен OWNER/ADMIN.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiForbiddenResponse({ description: 'Недостаточно прав' })
  async deactivate(@CurrentUser() user: AuthUser) {
    const subscription = await this.primeSubscriptionService.deactivateStub(
      user.accountId,
      user.userId
    );
    return this.toResponse(subscription);
  }

  private toResponse(
    subscription: PrimeSubscriptionView
  ): SubscriptionResponseDto {
    return {
      status: subscription.status,
      isPrime: subscription.isPrime,
      expiresAt: subscription.expiresAt?.toISOString() ?? null,
      startedAt: subscription.startedAt?.toISOString() ?? null,
    };
  }
}
