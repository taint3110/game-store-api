import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Game} from './game.model';
import {CustomerAccount} from './customer-account.model';

@model({
  settings: {
    mongodb: {collection: 'game-keys'},
  },
})
export class GameKey extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectId'},
  })
  id?: string;

  @belongsTo(() => Game)
  gameId: string;

  @property({
    type: 'string',
    required: true,
  })
  gameVersion: string;

  @property({
    type: 'string',
  })
  keyCode?: string;

  @belongsTo(() => CustomerAccount, {name: 'owner'})
  ownedByCustomerId?: string;

  @property({
    type: 'date',
    required: true,
    default: () => new Date(),
  })
  publishRegistrationDate: Date;

  @property({
    type: 'date',
  })
  customerOwnershipDate?: Date;

  @property({
    type: 'string',
    required: true,
    default: 'Available',
    jsonSchema: {
      enum: ['Available', 'Sold', 'Reserved'],
    },
  })
  businessStatus: string;

  @property({
    type: 'string',
    required: true,
    default: 'NotActivated',
    jsonSchema: {
      enum: ['Activated', 'NotActivated'],
    },
  })
  activationStatus: string;

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

  constructor(data?: Partial<GameKey>) {
    super(data);
  }
}

export interface GameKeyRelations {
  game?: Game;
  owner?: CustomerAccount;
}

export type GameKeyWithRelations = GameKey & GameKeyRelations;
