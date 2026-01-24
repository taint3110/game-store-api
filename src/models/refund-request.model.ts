import {Entity, belongsTo, model, property} from '@loopback/repository';
import {CustomerAccount} from './customer-account.model';
import {Order} from './order.model';

@model({
  settings: {
    mongodb: {collection: 'refund-requests'},
  },
})
export class RefundRequest extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectId'},
  })
  id?: string;

  @belongsTo(() => Order)
  orderId: string;

  @belongsTo(() => CustomerAccount)
  customerId: string;

  @property({
    type: 'string',
    required: true,
    default: 'Pending',
    jsonSchema: {
      enum: ['Pending', 'Approved', 'Rejected'],
    },
  })
  status: 'Pending' | 'Approved' | 'Rejected';

  @property({
    type: 'string',
    jsonSchema: {maxLength: 500},
  })
  reason?: string;

  @property({
    type: 'date',
    required: true,
    default: () => new Date(),
  })
  requestedAt: Date;

  @property({
    type: 'date',
  })
  resolvedAt?: Date;

  @property({
    type: 'string',
    jsonSchema: {maxLength: 500},
  })
  resolutionNote?: string;

  @property({
    type: 'string',
    description: 'Admin account id that processed this request',
  })
  processedByAdminId?: string;

  constructor(data?: Partial<RefundRequest>) {
    super(data);
  }
}

export interface RefundRequestRelations {
  order?: Order;
  customer?: CustomerAccount;
}

export type RefundRequestWithRelations = RefundRequest & RefundRequestRelations;

