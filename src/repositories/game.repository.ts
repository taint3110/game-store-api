import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {Game, GameRelations, PublisherAccount} from '../models';
import {PublisherAccountRepository} from './publisher-account.repository';

export class GameRepository extends DefaultCrudRepository<
  Game,
  typeof Game.prototype.id,
  GameRelations
> {
  public readonly publisher: BelongsToAccessor<PublisherAccount, typeof Game.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('PublisherAccountRepository')
    protected publisherAccountRepositoryGetter: Getter<PublisherAccountRepository>,
  ) {
    super(Game, dataSource);
    this.publisher = this.createBelongsToAccessorFor('publisher', publisherAccountRepositoryGetter);
    this.registerInclusionResolver('publisher', this.publisher.inclusionResolver);
  }

  async findByPublisher(publisherId: string): Promise<Game[]> {
    return this.find({where: {publisherId}});
  }

  async findByGenre(genre: string): Promise<Game[]> {
    return this.find({where: {genre}});
  }

  async searchByName(name: string): Promise<Game[]> {
    return this.find({
      where: {
        name: {regexp: new RegExp(name, 'i')},
      },
    });
  }

  async findAvailableGames(): Promise<Game[]> {
    return this.find({where: {releaseStatus: 'Released'}});
  }
}
