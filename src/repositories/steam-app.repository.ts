import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {SteamApp, SteamAppRelations} from '../models';

export class SteamAppRepository extends DefaultCrudRepository<
  SteamApp,
  typeof SteamApp.prototype.id,
  SteamAppRelations
> {
  constructor(@inject('datasources.mongodb') dataSource: MongodbDataSource) {
    super(SteamApp, dataSource);
  }
}
