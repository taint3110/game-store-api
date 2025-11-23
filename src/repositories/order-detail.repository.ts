import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {OrderDetail, OrderDetailRelations, Order, Game, GameKey} from '../models';
import {OrderRepository} from './order.repository';
import {GameRepository} from './game.repository';
import {GameKeyRepository} from './game-key.repository';

export class OrderDetailRepository extends DefaultCrudRepository<
  OrderDetail,
  typeof OrderDetail.prototype.id,
  OrderDetailRelations
> {
  public readonly order: BelongsToAccessor<Order, typeof OrderDetail.prototype.id>;
  public readonly game: BelongsToAccessor<Game, typeof OrderDetail.prototype.id>;
  public readonly gameKey: BelongsToAccessor<GameKey, typeof OrderDetail.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('OrderRepository')
    protected orderRepositoryGetter: Getter<OrderRepository>,
    @repository.getter('GameRepository')
    protected gameRepositoryGetter: Getter<GameRepository>,
    @repository.getter('GameKeyRepository')
    protected gameKeyRepositoryGetter: Getter<GameKeyRepository>,
  ) {
    super(OrderDetail, dataSource);
    this.order = this.createBelongsToAccessorFor('order', orderRepositoryGetter);
    this.registerInclusionResolver('order', this.order.inclusionResolver);
    this.game = this.createBelongsToAccessorFor('game', gameRepositoryGetter);
    this.registerInclusionResolver('game', this.game.inclusionResolver);
    this.gameKey = this.createBelongsToAccessorFor('gameKey', gameKeyRepositoryGetter);
    this.registerInclusionResolver('gameKey', this.gameKey.inclusionResolver);
  }
}
