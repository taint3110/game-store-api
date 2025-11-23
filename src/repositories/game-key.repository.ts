import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {GameKey, GameKeyRelations, Game, CustomerAccount} from '../models';
import {GameRepository} from './game.repository';
import {CustomerAccountRepository} from './customer-account.repository';

export class GameKeyRepository extends DefaultCrudRepository<
  GameKey,
  typeof GameKey.prototype.id,
  GameKeyRelations
> {
  public readonly game: BelongsToAccessor<Game, typeof GameKey.prototype.id>;
  public readonly owner: BelongsToAccessor<CustomerAccount, typeof GameKey.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('GameRepository')
    protected gameRepositoryGetter: Getter<GameRepository>,
    @repository.getter('CustomerAccountRepository')
    protected customerAccountRepositoryGetter: Getter<CustomerAccountRepository>,
  ) {
    super(GameKey, dataSource);
    this.game = this.createBelongsToAccessorFor('game', gameRepositoryGetter);
    this.registerInclusionResolver('game', this.game.inclusionResolver);
    this.owner = this.createBelongsToAccessorFor('owner', customerAccountRepositoryGetter);
    this.registerInclusionResolver('owner', this.owner.inclusionResolver);
  }

  async findAvailableKeys(gameId: string): Promise<GameKey[]> {
    return this.find({
      where: {
        gameId,
        businessStatus: 'Available',
      },
    });
  }

  async assignKeyToCustomer(keyId: string, customerId: string): Promise<void> {
    await this.updateById(keyId, {
      ownedByCustomerId: customerId,
      businessStatus: 'Sold',
      customerOwnershipDate: new Date(),
    });
  }

  async countAvailableKeys(gameId: string): Promise<number> {
    const result = await this.count({
      gameId,
      businessStatus: 'Available',
    });
    return result.count;
  }
}
