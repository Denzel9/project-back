import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListApplicationPartnersQueryDto } from './dto/list-application-partners-query.dto';
import { ListTaskPartnersQueryDto } from './dto/list-task-partners-query.dto';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@ApiCookieAuth('access-token')
@Controller('partners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get('tasks/executors')
  @Roles(Role.COMPANY)
  @ApiOperation({
    summary: 'Исполнители из задач (для компании)',
    description:
      'Уникальные креаторы-исполнители по задачам активной компании. ' +
      'Фильтры: `q`, `postId`, `taskId`, `userId`, `status` / `statuses`, `updatedDate`, `createdDate`, `isExecutorApprove`, `urgent`, `sort` (recent|name).',
  })
  @ApiOkResponse({ description: 'Список исполнителей с пагинацией' })
  @ApiForbiddenResponse({ description: 'Доступно только для роли COMPANY' })
  listTaskExecutors(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTaskPartnersQueryDto
  ) {
    return this.partnersService.listTaskExecutors(user, query);
  }

  @Get('tasks/customers')
  @Roles(Role.CREATOR)
  @ApiOperation({
    summary: 'Заказчики из задач (для креатора)',
    description:
      'Уникальные компании-заказчики по задачам, где креатор — исполнитель. ' +
      'Те же фильтры, что у `GET /partners/tasks/executors`.',
  })
  @ApiOkResponse({ description: 'Список заказчиков с пагинацией' })
  @ApiForbiddenResponse({ description: 'Доступно только для роли CREATOR' })
  listTaskCustomers(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTaskPartnersQueryDto
  ) {
    return this.partnersService.listTaskCustomers(user, query);
  }

  @Get('applications/applicants')
  @Roles(Role.COMPANY)
  @ApiOperation({
    summary: 'Соискатели по откликам (для компании)',
    description:
      'Уникальные креаторы, откликавшиеся на посты компании. ' +
      'Фильтры: `q` (имя/фамилия или название поста), `postId`, `userId`, `status` / `statuses`, `updatedDate`, `createdDate`, `sort`.',
  })
  @ApiOkResponse({ description: 'Список соискателей с пагинацией' })
  @ApiForbiddenResponse({ description: 'Доступно только для роли COMPANY' })
  listApplicationApplicants(
    @CurrentUser() user: AuthUser,
    @Query() query: ListApplicationPartnersQueryDto
  ) {
    return this.partnersService.listApplicationApplicants(user, query);
  }

  @Get('applications/companies')
  @Roles(Role.CREATOR)
  @ApiOperation({
    summary: 'Компании по откликам (для креатора)',
    description:
      'Уникальные компании, на посты которых откликался креатор. ' +
      'Фильтры: `q` (компания или название поста), `postId`, `userId`, `status` / `statuses`, `updatedDate`, `createdDate`, `sort`.',
  })
  @ApiOkResponse({ description: 'Список компаний с пагинацией' })
  @ApiForbiddenResponse({ description: 'Доступно только для роли CREATOR' })
  listApplicationCompanies(
    @CurrentUser() user: AuthUser,
    @Query() query: ListApplicationPartnersQueryDto
  ) {
    return this.partnersService.listApplicationCompanies(user, query);
  }
}
