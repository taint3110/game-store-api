import {Entity, model, property, belongsTo} from '@loopback/repository';
import {PublisherAccount} from './publisher-account.model';

@model({
  settings: {
    mongodb: {collection: 'games'},
  },
})
export class Game extends Entity {
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
  name: string;

  @property({
    type: 'string',
    required: true,
  })
  genre: string;

  @property({
    type: 'string',
    required: true,
  })
  description: string;

  @property({
    type: 'string',
  })
  imageUrl?: string;

  @property({
    type: 'string',
  })
  videoUrl?: string;

  @property({
    type: 'date',
    required: true,
  })
  releaseDate: Date;

  @belongsTo(() => PublisherAccount)
  publisherId: string;

  @property({
    type: 'string',
    required: true,
    default: 'Released',
    jsonSchema: {
      enum: ['Released', 'Upcoming', 'Delisted'],
    },
  })
  releaseStatus: string;

  @property({
    type: 'string',
    required: true,
  })
  version: string;

  @property({
    type: 'number',
    required: true,
    jsonSchema: {
      minimum: 0,
    },
  })
  originalPrice: number;

  @property({
    type: 'number',
    jsonSchema: {
      minimum: 0,
    },
  })
  discountPrice?: number;

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

  constructor(data?: Partial<Game>) {
    super(data);
  }
}

export interface GameRelations {
  publisher?: PublisherAccount;
}

export type GameWithRelations = Game & GameRelations;
