import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {PublisherAccount, PublisherAccountRelations} from '../models';

export class PublisherAccountRepository extends DefaultCrudRepository<
  PublisherAccount,
  typeof PublisherAccount.prototype.id,
  PublisherAccountRelations
> {
  constructor(@inject('datasources.mongodb') dataSource: MongodbDataSource) {
    super(PublisherAccount, dataSource);
  }

  async findByEmail(email: string): Promise<PublisherAccount | null> {
    return this.findOne({where: {email}});
  }
}
