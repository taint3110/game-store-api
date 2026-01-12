import {inject, Getter} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {CustomerAccount, Order, RefundRequest, RefundRequestRelations} from '../models';
import {CustomerAccountRepository} from './customer-account.repository';
import {OrderRepository} from './order.repository';

export class RefundRequestRepository extends DefaultCrudRepository<
  RefundRequest,
  typeof RefundRequest.prototype.id,
  RefundRequestRelations
> {
  public readonly order: BelongsToAccessor<Order, typeof RefundRequest.prototype.id>;
  public readonly customer: BelongsToAccessor<CustomerAccount, typeof RefundRequest.prototype.id>;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('OrderRepository')
    protected orderRepositoryGetter: Getter<OrderRepository>,
    @repository.getter('CustomerAccountRepository')
    protected customerAccountRepositoryGetter: Getter<CustomerAccountRepository>,
  ) {
    super(RefundRequest, dataSource);

    this.order = this.createBelongsToAccessorFor('order', orderRepositoryGetter);
    this.registerInclusionResolver('order', this.order.inclusionResolver);

    this.customer = this.createBelongsToAccessorFor(
      'customer',
      customerAccountRepositoryGetter,
    );
    this.registerInclusionResolver('customer', this.customer.inclusionResolver);
  }
}

