import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Gender} from './gender.model';

@model({
  settings: {
    mongodb: {collection: 'admin-accounts'},
    hiddenProperties: ['password'],
  },
})
export class AdminAccount extends Entity {
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
    },
  })
  email: string;

  @belongsTo(() => Gender)
  genderId?: string;

  @property({
    type: 'string',
    required: true,
  })
  phoneNumber: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['SuperAdmin', 'Admin', 'Moderator'],
    },
  })
  role: string;

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

  constructor(data?: Partial<AdminAccount>) {
    super(data);
  }
}

export interface AdminAccountRelations {
  gender?: Gender;
}

export type AdminAccountWithRelations = AdminAccount & AdminAccountRelations;
