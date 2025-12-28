import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
  HasManyRepositoryFactory,
} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {Order, OrderRelations, CustomerAccount, OrderDetail} from '../models';
import {CustomerAccountRepository} from './customer-account.repository';
import {OrderDetailRepository} from './order-detail.repository';

export class OrderRepository extends DefaultCrudRepository<
  Order,
  typeof Order.prototype.id,
  OrderRelations
> {
  public readonly customer: BelongsToAccessor<CustomerAccount, typeof Order.prototype.id>;
  public readonly orderDetails: HasManyRepositoryFactory<
    OrderDetail,
    typeof Order.prototype.id
  >;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('CustomerAccountRepository')
    protected customerAccountRepositoryGetter: Getter<CustomerAccountRepository>,
    @repository.getter('OrderDetailRepository')
    protected orderDetailRepositoryGetter: Getter<OrderDetailRepository>,
  ) {
    super(Order, dataSource);
    this.customer = this.createBelongsToAccessorFor('customer', customerAccountRepositoryGetter);
    this.registerInclusionResolver('customer', this.customer.inclusionResolver);

    this.orderDetails = this.createHasManyRepositoryFactoryFor(
      'orderDetails',
      orderDetailRepositoryGetter,
    );
    this.registerInclusionResolver('orderDetails', this.orderDetails.inclusionResolver);
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    return this.find({where: {customerId}});
  }

  async findPendingOrders(): Promise<Order[]> {
    return this.find({where: {paymentStatus: 'Pending'}});
  }
}
