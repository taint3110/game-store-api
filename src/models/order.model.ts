import {Entity, model, property, belongsTo, hasMany} from '@loopback/repository';
import {CustomerAccount} from './customer-account.model';
import {OrderDetail} from './order-detail.model';

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

  @hasMany(() => OrderDetail)
  orderDetails?: OrderDetail[];

  @property({
    type: 'array',
    itemType: 'object',
    jsonSchema: {
      items: {
        type: 'object',
        required: ['name', 'quantity', 'unitPriceCents', 'keyCodes'],
        properties: {
          steamAppId: {type: 'number', minimum: 0},
          slug: {type: 'string'},
          name: {type: 'string'},
          quantity: {type: 'number', minimum: 1, maximum: 99},
          unitPriceCents: {type: 'number', minimum: 0},
          image: {type: 'string'},
          keyCodes: {type: 'array', items: {type: 'string'}},
        },
      },
    },
  })
  items?: Array<{
    steamAppId?: number;
    slug?: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    image?: string;
    keyCodes: string[];
  }>;

  constructor(data?: Partial<Order>) {
    super(data);
  }
}

export interface OrderRelations {
  customer?: CustomerAccount;
  orderDetails?: OrderDetail[];
}

export type OrderWithRelations = Order & OrderRelations;
