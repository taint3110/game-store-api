import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {Gender, GenderRelations} from '../models';

export class GenderRepository extends DefaultCrudRepository<
  Gender,
  typeof Gender.prototype.id,
  GenderRelations
> {
  constructor(@inject('datasources.mongodb') dataSource: MongodbDataSource) {
    super(Gender, dataSource);
  }
}
