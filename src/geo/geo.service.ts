import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GeoPlaceDto } from './dto/geo-place.dto';

type NominatimResult = Record<string, unknown> & {
  display_name?: string;
  lat?: string;
  lon?: string;
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  licence?: string;
  class?: string;
  type?: string;
  place_rank?: number;
  importance?: number;
  addresstype?: string;
  name?: string;
  boundingbox?: string[];
  address?: Record<string, string>;
};

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string, limit = 5): Promise<GeoPlaceDto[]> {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return [];
    }

    const userAgent =
      this.config.get<string>('NOMINATIM_USER_AGENT') ??
      'NIKSSENSES/1.0 (geo-search; https://nikssenses.ru)';

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', trimmed);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('accept-language', 'ru');

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      this.logger.error('Nominatim request failed', error);
      throw new ServiceUnavailableException(
        'Сервис поиска локаций временно недоступен'
      );
    }

    if (!response.ok) {
      this.logger.warn(
        `Nominatim responded with ${response.status}: ${response.statusText}`
      );
      throw new BadGatewayException('Не удалось получить подсказки локаций');
    }

    const data = (await response.json()) as NominatimResult[];

    if (!Array.isArray(data)) {
      return [];
    }

    const seen = new Set<string>();

    return data
      .map(item => this.mapPlace(item))
      .filter((place): place is GeoPlaceDto => {
        if (!place?.label) return false;
        if (seen.has(place.label)) return false;
        seen.add(place.label);
        return true;
      });
  }

  private mapPlace(item: NominatimResult): GeoPlaceDto | null {
    const displayName = item.display_name?.trim();

    if (!displayName) {
      return null;
    }

    // Отдаём ответ Nominatim as-is + label = display_name для UI
    return {
      ...item,
      label: displayName,
      display_name: displayName,
      lat: item.lat ?? null,
      lon: item.lon ?? null,
      address: item.address ?? null,
    };
  }
}
