import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {CustomerAccount, CustomerAccountRelations, Gender} from '../models';
import {GenderRepository} from './gender.repository';

export class CustomerAccountRepository extends DefaultCrudRepository<
  CustomerAccount,
  typeof CustomerAccount.prototype.id,
  CustomerAccountRelations
> {
  public readonly gender: BelongsToAccessor<Gender, typeof CustomerAccount.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('GenderRepository')
    protected genderRepositoryGetter: Getter<GenderRepository>,
  ) {
    super(CustomerAccount, dataSource);
    this.gender = this.createBelongsToAccessorFor('gender', genderRepositoryGetter);
    this.registerInclusionResolver('gender', this.gender.inclusionResolver);
  }

  async findByEmail(email: string): Promise<CustomerAccount | null> {
    return this.findOne({where: {email}});
  }

  async findByPhoneNumber(phoneNumber: string): Promise<CustomerAccount | null> {
    return this.findOne({where: {phoneNumber}});
  }

  async findByCredentials(username: string): Promise<CustomerAccount | null> {
    return this.findOne({
      where: {
        or: [{email: username}, {phoneNumber: username}],
      },
    });
  }
}
