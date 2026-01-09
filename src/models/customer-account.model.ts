import {Entity, model, property, belongsTo, hasMany} from '@loopback/repository';
import {Gender} from './gender.model';

@model({
  settings: {
    mongodb: {collection: 'customer-accounts'},
    hiddenProperties: ['password'],
  },
})
export class CustomerAccount extends Entity {
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
    index: {unique: true},
    jsonSchema: {
      format: 'email',
      errorMessage: 'must be a valid email',
    },
  })
  email: string;

  @property({
    type: 'string',
    required: true,
    index: {unique: true},
    jsonSchema: {
      pattern: '^(0|\\+84)[0-9]{9,10}$',
      errorMessage: 'must be a valid Vietnamese phone number',
    },
  })
  phoneNumber: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 3,
      maxLength: 50,
    },
  })
  username: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 8,
    },
  })
  password: string;

  @belongsTo(() => Gender)
  genderId?: string;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  registrationDate: Date;

  @property({
    type: 'string',
    required: true,
    default: 'Active',
    jsonSchema: {
      enum: ['Active', 'Inactive', 'Suspended'],
    },
  })
  accountStatus: string;

  @property({
    type: 'number',
    required: true,
    default: 0,
    jsonSchema: {
      minimum: 0,
    },
  })
  accountBalance: number;

  @property({
    type: 'string',
  })
  bankType?: string;

  @property({
    type: 'string',
  })
  bankName?: string;

  @property({
    type: 'string',
  })
  description?: string;

  @property.array(Object, {
    jsonSchema: {
      items: {
        type: 'object',
        properties: {
          id: {type: 'string'},
          steamAppId: {type: 'number', minimum: 0},
          slug: {type: 'string'},
          name: {type: 'string'},
          image: {type: 'string'},
          priceLabel: {type: 'string'},
          originalPriceLabel: {type: 'string'},
          unitPriceCents: {type: 'number', minimum: 0},
        },
      },
    },
  })
  wishlist?: Array<{
    id: string;
    steamAppId?: number;
    slug?: string;
    name: string;
    image: string;
    priceLabel?: string | null;
    originalPriceLabel?: string | null;
    unitPriceCents?: number | null;
  }>;

  @property.array(Object, {
    jsonSchema: {
      items: {
        type: 'object',
        properties: {
          id: {type: 'string'},
          steamAppId: {type: 'number', minimum: 0},
          slug: {type: 'string'},
          name: {type: 'string'},
          image: {type: 'string'},
          priceLabel: {type: 'string'},
          originalPriceLabel: {type: 'string'},
          unitPriceCents: {type: 'number', minimum: 0},
          quantity: {type: 'number', minimum: 1, maximum: 99},
        },
      },
    },
  })
  cart?: Array<{
    id: string;
    steamAppId?: number;
    slug?: string;
    name: string;
    image: string;
    priceLabel?: string | null;
    originalPriceLabel?: string | null;
    unitPriceCents?: number | null;
    quantity: number;
  }>;

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

  constructor(data?: Partial<CustomerAccount>) {
    super(data);
  }
}

export interface CustomerAccountRelations {
  gender?: Gender;
}

export type CustomerAccountWithRelations = CustomerAccount & CustomerAccountRelations;
