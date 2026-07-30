import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GeoPlaceDto } from './dto/geo-place.dto';
import { GeoSearchQueryDto } from './dto/geo-search-query.dto';
import { GeoService } from './geo.service';

@ApiTags('geo')
@ApiCookieAuth('access-token')
@Controller('geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Поиск локаций (прокси Nominatim)',
    description:
      'Подсказки городов/адресов через OpenStreetMap Nominatim. ' +
      'Минимум 2 символа. Результат: label для записи в User.location.',
  })
  @ApiOkResponse({ type: GeoPlaceDto, isArray: true })
  search(@Query() query: GeoSearchQueryDto): Promise<GeoPlaceDto[]> {
    return this.geoService.search(query.q, query.limit ?? 5);
  }
}
