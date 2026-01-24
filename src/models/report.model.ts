import {Entity, model, property} from '@loopback/repository';

export type ReportTargetType = 'game' | 'review';
export type ReportStatus = 'Pending' | 'Resolved' | 'Rejected';
export type ReportReporterType = 'customer' | 'publisher';
export type ReportGameType = 'steam' | 'custom';

@model({
  settings: {
    mongodb: {collection: 'reports'},
  },
})
export class Report extends Entity {
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
    jsonSchema: {
      enum: ['customer', 'publisher'],
    },
  })
  reporterAccountType: ReportReporterType;

  @property({
    type: 'string',
    required: true,
  })
  reporterId: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['game', 'review'],
    },
  })
  targetType: ReportTargetType;

  @property({
    type: 'string',
    required: true,
  })
  targetId: string;

  @property({
    type: 'string',
    jsonSchema: {
      enum: ['steam', 'custom'],
    },
  })
  targetGameType?: ReportGameType;

  @property({
    type: 'string',
    jsonSchema: {
      enum: [
        'Spam',
        'Harassment',
        'HateSpeech',
        'Illegal',
        'Copyright',
        'Scam',
        'Other',
      ],
    },
  })
  reasonCategory?: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 10,
      maxLength: 2000,
    },
  })
  reasonText: string;

  @property({
    type: 'string',
    required: true,
    default: 'Pending',
    jsonSchema: {
      enum: ['Pending', 'Resolved', 'Rejected'],
    },
  })
  status: ReportStatus;

  @property({
    type: 'object',
  })
  metadata?: Record<string, any>;

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

  @property({
    type: 'date',
  })
  resolvedAt?: Date;

  @property({
    type: 'string',
  })
  resolvedByAdminId?: string;

  @property({
    type: 'string',
    jsonSchema: {maxLength: 2000},
  })
  resolutionNote?: string;

  constructor(data?: Partial<Report>) {
    super(data);
  }
}

export interface ReportRelations {}

export type ReportWithRelations = Report & ReportRelations;

