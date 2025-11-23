import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Order} from './order.model';
import {Game} from './game.model';
import {GameKey} from './game-key.model';

@model({
  settings: {
    mongodb: {collection: 'order-details'},
  },
})
export class OrderDetail extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectId'},
  })
  id?: string;

  @belongsTo(() => Order)
  orderId: string;

  @belongsTo(() => Game)
  gameId: string;

  @belongsTo(() => GameKey)
  gameKeyId: string;

  @property({
    type: 'number',
    required: true,
  })
  value: number;

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

  constructor(data?: Partial<OrderDetail>) {
    super(data);
  }
}

export interface OrderDetailRelations {
  order?: Order;
  game?: Game;
  gameKey?: GameKey;
}

export type OrderDetailWithRelations = OrderDetail & OrderDetailRelations;
