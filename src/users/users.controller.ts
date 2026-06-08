import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipWriteGuard } from '../auth/guards/membership-write.guard';
import { userResponseSchema } from '../auth/swagger/user-response.schema';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { UpdateUserDto } from './dto/update.dto';

@ApiTags('users')
@ApiCookieAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Получить профиль по id',
    description:
      'Публичные данные User: avatar, bio, creatorProfile/companyProfile и т.д. ' +
      'Email не возвращается (он хранится в Account). Доступен любому авторизованному пользователю.',
  })
  @ApiOkResponse({
    schema: userResponseSchema,
    description: 'Данные профиля',
  })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  async getProfile(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('update')
  @UseGuards(MembershipWriteGuard)
  @ApiOperation({
    summary: 'Обновить активный профиль',
    description:
      'Единственный эндпоинт редактирования профиля. Обновляет **текущий активный** User из JWT. ' +
      'Для CREATOR: name, lastName + общие поля. Для COMPANY: companyName + общие поля. ' +
      'Общие поля: phone, contacts, location, avatar, bio, aboutMe, banner. ' +
      'VIEWER получит 403. Для смены профиля перед редактированием — switch-profile.',
  })
  @ApiOkResponse({
    schema: userResponseSchema,
    description: 'Обновлённый профиль',
  })
  @ApiForbiddenResponse({
    description: 'Недостаточно прав (роль VIEWER)',
  })
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateUserDto
  ) {
    return this.usersService.update(user.userId, dto);
  }
}
