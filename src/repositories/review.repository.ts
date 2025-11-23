import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {Review, ReviewRelations, CustomerAccount, Game} from '../models';
import {CustomerAccountRepository} from './customer-account.repository';
import {GameRepository} from './game.repository';

export class ReviewRepository extends DefaultCrudRepository<
  Review,
  typeof Review.prototype.id,
  ReviewRelations
> {
  public readonly customer: BelongsToAccessor<CustomerAccount, typeof Review.prototype.id>;
  public readonly game: BelongsToAccessor<Game, typeof Review.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('CustomerAccountRepository')
    protected customerAccountRepositoryGetter: Getter<CustomerAccountRepository>,
    @repository.getter('GameRepository')
    protected gameRepositoryGetter: Getter<GameRepository>,
  ) {
    super(Review, dataSource);
    this.customer = this.createBelongsToAccessorFor('customer', customerAccountRepositoryGetter);
    this.registerInclusionResolver('customer', this.customer.inclusionResolver);
    this.game = this.createBelongsToAccessorFor('game', gameRepositoryGetter);
    this.registerInclusionResolver('game', this.game.inclusionResolver);
  }

  async findByGame(gameId: string): Promise<Review[]> {
    return this.find({where: {gameId}});
  }

  async findByCustomer(customerId: string): Promise<Review[]> {
    return this.find({where: {customerId}});
  }

  async calculateAverageRating(gameId: string): Promise<number> {
    const reviews = await this.find({where: {gameId}});
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviews.length;
  }
}
