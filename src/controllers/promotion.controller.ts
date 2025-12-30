import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {authenticate} from '@loopback/authentication';
import {get, post, param, requestBody, HttpErrors} from '@loopback/rest';
import {SecurityBindings, UserProfile} from '@loopback/security';
import {PromotionRepository} from '../repositories';

export class PromotionController {
  constructor(
    @repository(PromotionRepository)
    public promotionRepository: PromotionRepository,
  ) {}

  private ensureAdmin(currentUser: UserProfile) {
    if ((currentUser as any)?.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }
  }

  @get('/admin/promotions', {
    responses: {
      '200': {
        description: 'List promotions (admin only)',
      },
    },
  })
  @authenticate('jwt')
  async list(@inject(SecurityBindings.USER) currentUser: UserProfile) {
    this.ensureAdmin(currentUser);
    return this.promotionRepository.find({
      include: [{relation: 'publisher'}],
      order: ['createdAt DESC'],
    });
  }

  @get('/admin/promotions/{id}', {
    responses: {
      '200': {
        description: 'Promotion detail (admin only)',
      },
    },
  })
  @authenticate('jwt')
  async detail(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ) {
    this.ensureAdmin(currentUser);
    return this.promotionRepository.findById(id, {include: [{relation: 'publisher'}]});
  }

  @post('/admin/promotions', {
    responses: {
      '201': {
        description: 'Create promotion (admin only)',
      },
    },
  })
  @authenticate('jwt')
  async create(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: [
              'promotionName',
              'discountType',
              'applicableScope',
              'applicationCondition',
              'startDate',
              'expirationDate',
              'endDate',
              'quantityIssued',
              'status',
              'publisherId',
            ],
            properties: {
              promotionName: {type: 'string'},
              discountType: {type: 'string', enum: ['Percentage', 'FixedAmount']},
              applicableScope: {type: 'string', enum: ['AllGames', 'SpecificGames', 'Category']},
              applicationCondition: {type: 'string'},
              startDate: {type: 'string', format: 'date-time'},
              expirationDate: {type: 'string', format: 'date-time'},
              endDate: {type: 'string', format: 'date-time'},
              quantityIssued: {type: 'number', minimum: 0},
              status: {type: 'string', enum: ['Active', 'Inactive', 'Expired']},
              publisherId: {type: 'string'},
            },
          },
        },
      },
    })
    body: any,
  ) {
    this.ensureAdmin(currentUser);

    const now = new Date();
    return this.promotionRepository.create({
      promotionName: body.promotionName,
      discountType: body.discountType,
      applicableScope: body.applicableScope,
      applicationCondition: body.applicationCondition,
      startDate: body.startDate ? new Date(body.startDate) : now,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : now,
      endDate: body.endDate ? new Date(body.endDate) : now,
      quantityIssued: body.quantityIssued ?? 0,
      status: body.status,
      publisherId: body.publisherId,
      createdAt: now,
      updatedAt: now,
    } as any);
  }
}

