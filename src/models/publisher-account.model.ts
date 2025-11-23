import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'publisher-accounts'},
    hiddenProperties: ['password'],
  },
})
export class PublisherAccount extends Entity {
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
  publisherName: string;

  @property({
    type: 'string',
    required: true,
    index: {unique: true},
    jsonSchema: {
      format: 'email',
    },
  })
  email: string;

  @property({
    type: 'string',
    required: true,
  })
  phoneNumber: string;

  @property({
    type: 'string',
  })
  socialMedia?: string;

  @property({
    type: 'string',
  })
  bankType?: string;

  @property({
    type: 'string',
  })
  bankName?: string;

  @property({
    type: 'date',
    required: true,
  })
  contractDate: Date;

  @property({
    type: 'number',
    required: true,
    jsonSchema: {
      minimum: 1,
    },
  })
  contractDuration: number;

  @property({
    type: 'string',
    required: true,
    default: 'Active',
    jsonSchema: {
      enum: ['Active', 'Inactive'],
    },
  })
  activityStatus: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 8,
    },
  })
  password: string;

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

  constructor(data?: Partial<PublisherAccount>) {
    super(data);
  }
}

export interface PublisherAccountRelations {
  // describe navigational properties here
}

export type PublisherAccountWithRelations = PublisherAccount & PublisherAccountRelations;
