import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {AdminAccount, AdminAccountRelations, Gender} from '../models';
import {GenderRepository} from './gender.repository';

export class AdminAccountRepository extends DefaultCrudRepository<
  AdminAccount,
  typeof AdminAccount.prototype.id,
  AdminAccountRelations
> {
  public readonly gender: BelongsToAccessor<Gender, typeof AdminAccount.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('GenderRepository')
    protected genderRepositoryGetter: Getter<GenderRepository>,
  ) {
    super(AdminAccount, dataSource);
    this.gender = this.createBelongsToAccessorFor('gender', genderRepositoryGetter);
    this.registerInclusionResolver('gender', this.gender.inclusionResolver);
  }

  async findByEmail(email: string): Promise<AdminAccount | null> {
    return this.findOne({where: {email}});
  }
}
