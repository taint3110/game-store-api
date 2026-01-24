import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'steam_apps'},
  },
})
export class SteamApp extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectId'},
  })
  id?: string;

  @property({
    type: 'number',
    required: true,
    jsonSchema: {
      minimum: 0,
    },
  })
  steamAppId: number;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
  })
  avatarUrl?: string;

  @property({
    type: 'string',
  })
  detailsUrl?: string;

  @property({
    type: 'date',
  })
  createdAt?: Date;

  @property({
    type: 'date',
  })
  updatedAt?: Date;

  constructor(data?: Partial<SteamApp>) {
    super(data);
  }
}

export interface SteamAppRelations {}

export type SteamAppWithRelations = SteamApp & SteamAppRelations;
