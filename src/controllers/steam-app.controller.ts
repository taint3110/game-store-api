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

