import {Entity, model, property, belongsTo} from '@loopback/repository';
import {PublisherAccount} from './publisher-account.model';

@model({
  settings: {
    mongodb: {collection: 'promotions'},
  },
})
export class Promotion extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectId'},
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  promotionName: string;

  @property({
    type: 'string',
    required: true,
  })
  code: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['Percentage', 'FixedAmount'],
    },
  })
  discountType: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['AllGames', 'SpecificGames', 'Category'],
    },
  })
  applicableScope: string;

  @property({
    type: 'string',
    required: true,
  })
  applicationCondition: string;

  @property({
    type: 'date',
    required: true,
  })
  startDate: Date;

  @property({
    type: 'date',
    required: true,
  })
  expirationDate: Date;

  @property({
    type: 'date',
    required: true,
  })
  endDate: Date;

  @property({
    type: 'number',
    required: true,
    jsonSchema: {
      minimum: 0,
    },
  })
  quantityIssued: number;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['Active', 'Inactive', 'Expired'],
    },
  })
  status: string;

  @belongsTo(() => PublisherAccount)
  publisherId: string;

  @property({
    type: 'string',
    default: 'Publisher',
    jsonSchema: {
      enum: ['Publisher', 'Store'],
    },
  })
  scope?: string;

  @property({
    type: 'array',
    itemType: 'string',
  })
  gameIds?: string[];

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

  constructor(data?: Partial<Promotion>) {
    super(data);
  }
}

export interface PromotionRelations {
  publisher?: PublisherAccount;
}

export type PromotionWithRelations = Promotion & PromotionRelations;
