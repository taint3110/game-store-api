import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {Order, OrderRelations, CustomerAccount} from '../models';
import {CustomerAccountRepository} from './customer-account.repository';

export class OrderRepository extends DefaultCrudRepository<
  Order,
  typeof Order.prototype.id,
  OrderRelations
> {
  public readonly customer: BelongsToAccessor<CustomerAccount, typeof Order.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('CustomerAccountRepository')
    protected customerAccountRepositoryGetter: Getter<CustomerAccountRepository>,
  ) {
    super(Order, dataSource);
    this.customer = this.createBelongsToAccessorFor('customer', customerAccountRepositoryGetter);
    this.registerInclusionResolver('customer', this.customer.inclusionResolver);
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    return this.find({where: {customerId}});
  }

  async findPendingOrders(): Promise<Order[]> {
    return this.find({where: {paymentStatus: 'Pending'}});
  }
}
