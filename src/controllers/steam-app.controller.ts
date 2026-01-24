import {repository} from '@loopback/repository';
import {get, HttpErrors, param} from '@loopback/rest';
import {SteamApp} from '../models';
import {SteamAppRepository} from '../repositories';

export class SteamAppController {
  constructor(
    @repository(SteamAppRepository)
    public steamAppRepository: SteamAppRepository,
  ) {}

  @get('/steam-apps', {
    responses: {
      '200': {
        description: 'Array of SteamApp model instances',
        content: {
          'application/json': {
            schema: {type: 'array', items: {'x-ts-type': SteamApp}},
          },
        },
      },
    },
  })
  async find(
    @param.query.string('search') search?: string,
    @param.query.number('skip') skip = 0,
    @param.query.number('limit') limit = 24,
  ): Promise<SteamApp[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const where: any = {};
    if (search) {
      where.name = {regexp: new RegExp(search, 'i')};
    }

    return this.steamAppRepository.find({
      where,
      skip,
      limit: safeLimit,
      order: ['steamAppId ASC'],
    });
  }

  @get('/steam-apps/bulk', {
    responses: {
      '200': {
        description: 'Bulk lookup SteamApp records by steamAppId',
        content: {
          'application/json': {
            schema: {type: 'array', items: {'x-ts-type': SteamApp}},
          },
        },
      },
    },
  })
  async bulkFind(
    @param.query.string('ids') ids?: string,
  ): Promise<SteamApp[]> {
    const parsed = (ids || '')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n > 0)
      .map(n => Math.floor(n));

    const unique = Array.from(new Set(parsed)).slice(0, 100);
    if (unique.length === 0) return [];

    const apps = await this.steamAppRepository.find({
      where: {steamAppId: {inq: unique}},
      order: ['steamAppId ASC'],
    });

    const byId = new Map<number, SteamApp>(apps.map(a => [a.steamAppId, a]));
    return unique.map(id => byId.get(id)).filter(Boolean) as SteamApp[];
  }

  @get('/steam-apps/{steamAppId}', {
    responses: {
      '200': {
        description: 'SteamApp model instance',
        content: {'application/json': {schema: {'x-ts-type': SteamApp}}},
      },
    },
  })
  async findBySteamAppId(
    @param.path.number('steamAppId') steamAppId: number,
  ): Promise<SteamApp> {
    const app = await this.steamAppRepository.findOne({where: {steamAppId}});
    if (!app) {
      throw new HttpErrors.NotFound(`Steam app not found: ${steamAppId}`);
    }
    return app;
  }
}

