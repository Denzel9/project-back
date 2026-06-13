import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from './auth-cookies';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterCreatorDto } from './dto/register-creator.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SwitchProfileDto } from './dto/switch-profile.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import {
  AuthSessionUserResponse,
  ProfileSummaryResponse,
} from './dto/profile-summary.response';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/creator')
  @ApiOperation({
    summary: 'Регистрация креатора',
    description:
      'Первый вход: создаёт Account (email/password) и первый профиль User с ролью CREATOR. ' +
      'Выставляет cookies access-token и refresh-token. Email должен быть уникальным.',
  })
  @ApiCreatedResponse({
    type: AuthSessionUserResponse,
    description: 'Account и профиль созданы, пользователь авторизован',
  })
  @ApiConflictResponse({ description: 'Email уже зарегистрирован' })
  async registerCreator(
    @Body() dto: RegisterCreatorDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, tokens, rememberMe } = await this.authService.registerCreator(
      dto
    );
    setAuthCookies(res, tokens, { rememberMe });
    return { user };
  }

  @Post('register/company')
  @ApiOperation({
    summary: 'Регистрация компании',
    description:
      'Первый вход: создаёт Account (email/password) и первый профиль User с ролью COMPANY. ' +
      'Выставляет cookies. Email должен быть уникальным.',
  })
  @ApiCreatedResponse({
    type: AuthSessionUserResponse,
    description: 'Account и профиль созданы, пользователь авторизован',
  })
  @ApiConflictResponse({ description: 'Email уже зарегистрирован' })
  async registerCompany(
    @Body() dto: RegisterCompanyDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, tokens, rememberMe } = await this.authService.registerCompany(
      dto
    );
    setAuthCookies(res, tokens, { rememberMe });
    return { user };
  }

  @Post('login')
  @ApiOperation({
    summary: 'Вход',
    description:
      'Аутентификация по email и password Account. ' +
      'Активирует первый доступный профиль (или тот, что был при последнем switch). ' +
      'Выставляет cookies. rememberMe=true — refresh на 30 дней, иначе 7 дней.',
  })
  @ApiOkResponse({
    type: AuthSessionUserResponse,
    description: 'Успешный вход',
  })
  @ApiUnauthorizedResponse({ description: 'Неверный email или пароль' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, tokens, rememberMe } = await this.authService.login(dto);
    setAuthCookies(res, tokens, { rememberMe });
    return { user };
  }

  @Get('profiles')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @ApiOperation({
    summary: 'Список доступных профилей',
    description:
      'Все профили User, к которым текущий Account имеет доступ: свои (OWNER) и чужие через invite. ' +
      'Используйте для переключателя профилей на фронте. Поле isActive — текущий профиль в JWT.',
  })
  @ApiOkResponse({
    type: ProfileSummaryResponse,
    isArray: true,
    description: 'Массив профилей с displayName, role, membershipRole',
  })
  listProfiles(@CurrentUser() user: AuthUser) {
    return this.authService.listProfiles(user);
  }

  @Post('switch-profile')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @ApiOperation({
    summary: 'Переключить активный профиль',
    description:
      'Меняет активный User в JWT (sub). Нужен userId из GET /auth/profiles. ' +
      'После переключения все запросы (чат, PATCH профиля) идут от имени выбранного профиля. ' +
      'Обновляет cookies.',
  })
  @ApiOkResponse({
    type: AuthSessionUserResponse,
    description: 'Профиль переключён, новые cookies',
  })
  @ApiForbiddenResponse({ description: 'Нет membership к этому профилю' })
  async switchProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: SwitchProfileDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;
    const {
      user: activeUser,
      tokens,
      rememberMe,
    } = await this.authService.switchProfile(user, dto, refreshToken);
    setAuthCookies(res, tokens, { rememberMe });
    return { user: activeUser };
  }

  @Post('invites')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @ApiOperation({
    summary: 'Пригласить менеджера к существующему профилю',
    description:
      'Отправляет письмо на email приглашённого. userId — **существующий** профиль, которым вы управляете. ' +
      'Требуется роль OWNER или ADMIN на этом профиле. ' +
      'Роли invite: ADMIN, EDITOR, VIEWER (не OWNER). ' +
      'Приглашённый должен зарегистрироваться/войти своим email и принять invite.',
  })
  @ApiCreatedResponse({ description: 'Приглашение создано, письмо отправлено' })
  @ApiForbiddenResponse({
    description: 'Недостаточно прав (нужен OWNER/ADMIN на профиле)',
  })
  createInvite(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto) {
    return this.authService.createInvite(user, dto);
  }

  @Post('invites/accept')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access-token')
  @ApiOperation({
    summary: 'Принять приглашение',
    description:
      'Принимает invite по token из письма (ссылка /invites/accept?token=...). ' +
      'Email залогиненного Account должен совпадать с email в приглашении. ' +
      'После accept профиль появится в GET /auth/profiles.',
  })
  @ApiOkResponse({ description: 'Приглашение принято, membership создан' })
  @ApiBadRequestResponse({
    description: 'Недействительный или просроченный token',
  })
  @ApiForbiddenResponse({
    description: 'Email аккаунта не совпадает с email в приглашении',
  })
  acceptInvite(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(user, dto);
  }

  @Delete('memberships/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('access-token')
  @ApiOperation({
    summary: 'Отозвать доступ к профилю',
    description:
      'Удаляет membership другого человека к профилю, которым вы управляете. ' +
      'id — membershipId из GET /auth/profiles. Нельзя отозвать OWNER. ' +
      'Требуется OWNER или ADMIN на профиле.',
  })
  @ApiNoContentResponse({ description: 'Доступ отозван' })
  @ApiForbiddenResponse({ description: 'Недостаточно прав' })
  revokeMembership(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) membershipId: string
  ) {
    return this.authService.revokeMembership(user, membershipId);
  }

  @Post('recovery-password')
  @ApiOperation({
    summary: 'Запрос сброса пароля',
    description:
      'Отправляет письмо со ссылкой сброса, если Account с таким email существует. ' +
      'Всегда возвращает успех (защита от перебора email).',
  })
  @ApiOkResponse({
    description: 'Сообщение об отправке письма (независимо от наличия email)',
    schema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  })
  async recoveryPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Установить новый пароль',
    description:
      'Меняет password Account по token из письма. ' +
      'Token передаёт фронт из query-параметра URL письма.',
  })
  @ApiOkResponse({
    description: 'Пароль изменён',
    schema: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
  })
  @ApiBadRequestResponse({
    description: 'Недействительный или просроченный token',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Обновить access token',
    description:
      'Читает refresh-token из cookie, выдаёт новую пару токенов. ' +
      'Вызывать при истечении access-token или proактивно с фронта.',
  })
  @ApiOkResponse({
    type: AuthSessionUserResponse,
    description: 'Токены обновлены',
  })
  @ApiUnauthorizedResponse({
    description: 'Неверный или устаревший refresh token (нужен перелогин)',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;
    const { user, tokens, rememberMe } = await this.authService.refresh(
      refreshToken ?? ''
    );
    setAuthCookies(res, tokens, { rememberMe });
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Выход',
    description: 'Очищает cookies access-token и refresh-token.',
  })
  @ApiNoContentResponse({ description: 'Выход выполнен' })
  logout(@Res({ passthrough: true }) res: Response): void {
    clearAuthCookies(res);
  }
}
