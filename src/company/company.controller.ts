import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthSessionUserResponse } from '../auth/dto/profile-summary.response';

@ApiTags('company')
@ApiCookieAuth('access-token')
@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.COMPANY)
export class CompanyController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Краткая информация об активном профиле компании',
    description:
      'Возвращает id, role и membershipRole **активного** профиля из JWT. ' +
      'Доступен только если активный профиль — COMPANY. ' +
      'Полные данные — GET /users/:id, редактирование — PATCH /users/update.',
  })
  @ApiOkResponse({
    type: AuthSessionUserResponse,
    description: 'id, role, membershipRole',
  })
  @ApiForbiddenResponse({
    description: 'Активный профиль не COMPANY',
  })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user).then((profile) => ({ user: profile }));
  }
}
