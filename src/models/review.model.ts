import {Entity, model, property, belongsTo} from '@loopback/repository';
import {CustomerAccount} from './customer-account.model';
import {Game} from './game.model';

@model({
  settings: {
    mongodb: {collection: 'reviews'},
    indexes: {
      uniqueCustomerGame: {
        keys: {customerId: 1, gameId: 1},
        options: {unique: true},
      },
    },
  },
})
export class Review extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectId'},
  })
  id?: string;

  @belongsTo(() => CustomerAccount)
  customerId: string;

  @belongsTo(() => Game)
  gameId: string;

  @property({
    type: 'string',
    required: true,
  })
  reviewText: string;

  @property({
    type: 'number',
    required: true,
    jsonSchema: {
      minimum: 1,
      maximum: 5,
    },
  })
  rating: number;

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

  constructor(data?: Partial<Review>) {
    super(data);
  }
}

export interface ReviewRelations {
  customer?: CustomerAccount;
  game?: Game;
}

export type ReviewWithRelations = Review & ReviewRelations;
