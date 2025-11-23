import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {Promotion, PromotionRelations, PublisherAccount} from '../models';
import {PublisherAccountRepository} from './publisher-account.repository';

export class PromotionRepository extends DefaultCrudRepository<
  Promotion,
  typeof Promotion.prototype.id,
  PromotionRelations
> {
  public readonly publisher: BelongsToAccessor<PublisherAccount, typeof Promotion.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('PublisherAccountRepository')
    protected publisherAccountRepositoryGetter: Getter<PublisherAccountRepository>,
  ) {
    super(Promotion, dataSource);
    this.publisher = this.createBelongsToAccessorFor('publisher', publisherAccountRepositoryGetter);
    this.registerInclusionResolver('publisher', this.publisher.inclusionResolver);
  }
}
