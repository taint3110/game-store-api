import {Entity, model, property, belongsTo} from '@loopback/repository';
import {CustomerAccount} from './customer-account.model';

@model({
  settings: {
    mongodb: {collection: 'orders'},
  },
})
export class Order extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectId'},
  })
  id?: string;

  @belongsTo(() => CustomerAccount)
  customerId: string;

  @property({
    type: 'date',
    required: true,
    default: () => new Date(),
  })
  orderDate: Date;

  @property({
    type: 'number',
    required: true,
    jsonSchema: {
      minimum: 0,
    },
  })
  totalValue: number;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['Wallet', 'CreditCard', 'PayPal'],
    },
  })
  paymentMethod: string;

  @property({
    type: 'string',
    required: true,
    index: {unique: true},
  })
  transactionId: string;

  @property({
    type: 'string',
    required: true,
    default: 'Pending',
    jsonSchema: {
      enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    },
  })
  paymentStatus: string;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  createdAt: Date;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  updatedAt: Date;

  constructor(data?: Partial<Order>) {
    super(data);
  }
}

export interface OrderRelations {
  customer?: CustomerAccount;
}

export type OrderWithRelations = Order & OrderRelations;
