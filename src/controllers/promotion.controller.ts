import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {authenticate} from '@loopback/authentication';
import {get, post, patch, del, param, requestBody, HttpErrors} from '@loopback/rest';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {GameRepository, PromotionRepository} from '../repositories';

export class PromotionController {
  constructor(
    @repository(PromotionRepository)
    public promotionRepository: PromotionRepository,
    @repository(GameRepository)
    public gameRepository: GameRepository,
  ) {}

  private normalizePromoCode(value: unknown) {
    return String(value ?? '').trim();
  }

  private parseDateOrUndefined(value: unknown): Date | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && !value.trim()) return undefined;
    const date = new Date(value as any);
    if (!Number.isFinite(date.getTime())) {
      throw new HttpErrors.UnprocessableEntity('Invalid date value.');
    }
    return date;
  }

  private normalizePromoDates(input: {
    start?: Date;
    expiration?: Date;
    end?: Date;
    fallbackNow: Date;
  }): {startDate: Date; expirationDate: Date; endDate: Date} {
    const startDate = input.start ?? input.fallbackNow;
    const candidateExpiration = input.expiration;
    const candidateEnd = input.end;

    // Treat `expirationDate` and `endDate` as aliases; pick the later one to avoid accidental early expiry.
    const effectiveEnd =
      candidateEnd && candidateExpiration
        ? new Date(Math.max(candidateEnd.getTime(), candidateExpiration.getTime()))
        : candidateEnd ?? candidateExpiration ?? startDate;

    if (effectiveEnd.getTime() < startDate.getTime()) {
      throw new HttpErrors.UnprocessableEntity('endDate must be greater than or equal to startDate.');
    }

    return {
      startDate,
      expirationDate: effectiveEnd,
      endDate: effectiveEnd,
    };
  }

  private assertValidPromoCode(code: string) {
    // Keep codes simple for UX + avoid whitespace issues.
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(code)) {
      throw new HttpErrors.UnprocessableEntity(
        'Promo code must be 3-32 characters and contain only letters, numbers, "_" or "-".',
      );
    }
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async ensurePromoCodeUnique(code: string, excludeId?: string) {
    const safe = this.normalizePromoCode(code);
    if (!safe) throw new HttpErrors.BadRequest('code is required');

    const escaped = this.escapeRegex(safe);
    const regex = new RegExp(`^${escaped}$`, 'i');
    const where: any = {
      or: [{code: {regexp: regex}}, {promotionName: {regexp: regex}}],
    };
    if (excludeId) where.id = {neq: excludeId};

    const existing = await this.promotionRepository.find({where, limit: 1});
    if (existing[0]) {
      throw new HttpErrors.Conflict('Promo code already exists.');
    }
  }

  private isAdmin(currentUser: UserProfile) {
    return (currentUser as any)?.accountType === 'admin';
  }

  private isPublisher(currentUser: UserProfile) {
    return (currentUser as any)?.accountType === 'publisher';
  }

  private isStoreScope(value: unknown) {
    return String(value ?? '').trim() === 'Store';
  }

  private ensureAdminOrPublisher(currentUser: UserProfile) {
    if (!this.isAdmin(currentUser) && !this.isPublisher(currentUser)) {
      throw new HttpErrors.Forbidden('Admin or publisher access required');
    }
  }

  private getCurrentUserId(currentUser: UserProfile) {
    return (currentUser as any)?.id || currentUser[securityId];
  }

  private isObjectId(value: unknown) {
    return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
  }

  private async validateGameOwnership(publisherId: string, gameIds: unknown) {
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      throw new HttpErrors.UnprocessableEntity('gameIds is required for SpecificGames promotions.');
    }

    const normalized = gameIds.map(String);
    for (const gameId of normalized) {
      if (!this.isObjectId(gameId)) {
        throw new HttpErrors.UnprocessableEntity(`Invalid gameId: ${gameId}`);
      }

      const game = await this.gameRepository.findById(gameId).catch(() => null as any);
      if (!game) {
        throw new HttpErrors.UnprocessableEntity(`Game not found: ${gameId}`);
      }
      const gamePublisherId = String((game as any).publisherId ?? '');
      if (gamePublisherId !== String(publisherId)) {
        throw new HttpErrors.Forbidden(
          'This promotion can only apply to games owned by the selected publisher.',
        );
      }
    }

    return normalized;
  }

  private async ensureCanAccessPromotion(currentUser: UserProfile, promoId: string) {
    const promo = await this.promotionRepository.findById(promoId);
    if (this.isAdmin(currentUser)) return promo;

    if (this.isStoreScope((promo as any).scope)) {
      throw new HttpErrors.Forbidden('Only admins can manage store-wide promotions.');
    }

    const currentId = this.getCurrentUserId(currentUser);
    if (!currentId || promo.publisherId !== currentId) {
      throw new HttpErrors.Forbidden('You can only manage your own promotions.');
    }

    return promo;
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
    this.ensureAdminOrPublisher(currentUser);

    const where = this.isPublisher(currentUser)
      ? {publisherId: this.getCurrentUserId(currentUser), scope: {neq: 'Store'}}
      : {};
    return this.promotionRepository.find({
      where,
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
    this.ensureAdminOrPublisher(currentUser);
    const promo = await this.ensureCanAccessPromotion(currentUser, id);
    const withPublisher = await this.promotionRepository.findById(promo.id as string, {
      include: [{relation: 'publisher'}],
    });
    return withPublisher;
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
              'code',
              'discountType',
              'applicableScope',
              'applicationCondition',
              'startDate',
              'expirationDate',
              'endDate',
              'quantityIssued',
              'status',
            ],
            properties: {
              promotionName: {type: 'string'},
              code: {type: 'string'},
              discountType: {type: 'string', enum: ['Percentage', 'FixedAmount']},
              applicableScope: {type: 'string', enum: ['AllGames', 'SpecificGames', 'Category']},
              applicationCondition: {type: 'string'},
              startDate: {type: 'string', format: 'date-time'},
              expirationDate: {type: 'string', format: 'date-time'},
              endDate: {type: 'string', format: 'date-time'},
              quantityIssued: {type: 'number', minimum: 0},
              status: {type: 'string', enum: ['Active', 'Inactive', 'Expired']},
              publisherId: {type: 'string'},
              gameIds: {type: 'array', items: {type: 'string'}},
              scope: {type: 'string', enum: ['Publisher', 'Store']},
            },
          },
        },
      },
    })
    body: any,
  ) {
    this.ensureAdminOrPublisher(currentUser);

    const now = new Date();

    const code = this.normalizePromoCode(body?.code);
    if (!code) throw new HttpErrors.BadRequest('code is required');
    this.assertValidPromoCode(code);
    await this.ensurePromoCodeUnique(code);

    const requestedScope = String(body?.scope ?? '').trim();
    const scope = this.isPublisher(currentUser) ? 'Publisher' : requestedScope || 'Publisher';

    if (scope === 'Store') {
      if (!this.isAdmin(currentUser)) {
        throw new HttpErrors.Forbidden('Only admins can create store-wide promotions.');
      }
      if (body.applicableScope !== 'AllGames') {
        throw new HttpErrors.UnprocessableEntity('Store-wide promotions currently support AllGames only.');
      }
    }

    // If caller is a publisher, force publisherId to their id.
    // For store-wide promotions, use a placeholder ObjectId so the Mongo schema stays consistent.
    const publisherId =
      scope === 'Store'
        ? '000000000000000000000000'
        : this.isPublisher(currentUser)
          ? this.getCurrentUserId(currentUser)
          : body.publisherId;

    if (!publisherId) {
      throw new HttpErrors.BadRequest('publisherId is required');
    }
    if (!this.isObjectId(publisherId)) {
      throw new HttpErrors.UnprocessableEntity('publisherId must be a valid ObjectId');
    }

    const applicableScope = body.applicableScope;
    const gameIds =
      scope !== 'Store' && applicableScope === 'SpecificGames'
        ? await this.validateGameOwnership(publisherId, body.gameIds)
        : undefined;

    const start = this.parseDateOrUndefined(body.startDate);
    const expiration = this.parseDateOrUndefined(body.expirationDate);
    const end = this.parseDateOrUndefined(body.endDate);
    const {startDate, expirationDate, endDate} = this.normalizePromoDates({
      start,
      expiration,
      end,
      fallbackNow: now,
    });

    return this.promotionRepository.create({
      promotionName: body.promotionName,
      code,
      discountType: body.discountType,
      applicableScope,
      applicationCondition: body.applicationCondition,
      startDate,
      expirationDate,
      endDate,
      quantityIssued: body.quantityIssued ?? 0,
      status: body.status,
      publisherId,
      scope,
      gameIds,
      createdAt: now,
      updatedAt: now,
    } as any);
  }

  @patch('/admin/promotions/{id}', {
    responses: {
      '200': {
        description: 'Update a promotion (admin/publisher)',
      },
    },
  })
  @authenticate('jwt')
  async update(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              promotionName: {type: 'string'},
              code: {type: 'string'},
              discountType: {type: 'string', enum: ['Percentage', 'FixedAmount']},
              applicableScope: {type: 'string', enum: ['AllGames', 'SpecificGames', 'Category']},
              applicationCondition: {type: 'string'},
              startDate: {type: 'string', format: 'date-time'},
              expirationDate: {type: 'string', format: 'date-time'},
              endDate: {type: 'string', format: 'date-time'},
              quantityIssued: {type: 'number', minimum: 0},
              status: {type: 'string', enum: ['Active', 'Inactive', 'Expired']},
              publisherId: {type: 'string'},
              gameIds: {type: 'array', items: {type: 'string'}},
              scope: {type: 'string', enum: ['Publisher', 'Store']},
            },
          },
        },
      },
    })
    body: any,
  ) {
    this.ensureAdminOrPublisher(currentUser);

    const existing = await this.ensureCanAccessPromotion(currentUser, id);

    if (body.code !== undefined) {
      const nextCode = this.normalizePromoCode(body.code);
      if (!nextCode) throw new HttpErrors.BadRequest('code is required');
      this.assertValidPromoCode(nextCode);
      await this.ensurePromoCodeUnique(nextCode, String(id));
    }

    if (this.isStoreScope((existing as any).scope)) {
      if (!this.isAdmin(currentUser)) {
        throw new HttpErrors.Forbidden('Only admins can manage store-wide promotions.');
      }
      delete body.publisherId;
      delete body.scope;
      if (body.applicableScope && body.applicableScope !== 'AllGames') {
        throw new HttpErrors.UnprocessableEntity('Store-wide promotions currently support AllGames only.');
      }
      if (body.gameIds !== undefined) {
        delete body.gameIds;
      }
    }

    const isAdmin = this.isAdmin(currentUser);
    const publisherId = isAdmin ? (body.publisherId ?? existing.publisherId) : existing.publisherId;
    if (!publisherId || !this.isObjectId(publisherId)) {
      throw new HttpErrors.UnprocessableEntity('publisherId must be a valid ObjectId');
    }

    const applicableScope = body.applicableScope ?? existing.applicableScope;
    const gameIds =
      !this.isStoreScope((existing as any).scope) && applicableScope === 'SpecificGames'
        ? await this.validateGameOwnership(publisherId, body.gameIds ?? existing.gameIds)
        : undefined;

    const patchData: any = {
      updatedAt: new Date(),
      gameIds,
    };

    const allowedFields = [
      'promotionName',
      'code',
      'discountType',
      'applicableScope',
      'applicationCondition',
      'quantityIssued',
      'status',
    ];

    for (const key of allowedFields) {
      if (body[key] !== undefined) patchData[key] = body[key];
    }

    const existingStart = (existing as any).startDate ? new Date((existing as any).startDate) : new Date();
    const existingExpiration = (existing as any).expirationDate
      ? new Date((existing as any).expirationDate)
      : (existing as any).endDate
        ? new Date((existing as any).endDate)
        : existingStart;
    const existingEnd = (existing as any).endDate ? new Date((existing as any).endDate) : existingExpiration;

    const start = body.startDate !== undefined ? this.parseDateOrUndefined(body.startDate) : undefined;
    const expiration =
      body.expirationDate !== undefined ? this.parseDateOrUndefined(body.expirationDate) : undefined;
    const end = body.endDate !== undefined ? this.parseDateOrUndefined(body.endDate) : undefined;

    const shouldUpdateDates = start !== undefined || expiration !== undefined || end !== undefined;
    if (shouldUpdateDates) {
      const {startDate, expirationDate, endDate} = this.normalizePromoDates({
        start: start ?? existingStart,
        expiration: expiration ?? existingExpiration,
        end: end ?? existingEnd,
        fallbackNow: new Date(),
      });

      patchData.startDate = startDate;
      patchData.expirationDate = expirationDate;
      patchData.endDate = endDate;
    } else if (body.startDate !== undefined) {
      // If a caller explicitly sends an empty string, ignore it rather than corrupting the stored date.
      // (parseDateOrUndefined returns undefined for empty strings)
    }

    if (isAdmin && body.publisherId !== undefined) {
      patchData.publisherId = publisherId;
    }

    await this.promotionRepository.updateById(id, patchData);
    return this.promotionRepository.findById(id, {include: [{relation: 'publisher'}]});
  }

  @del('/admin/promotions/{id}', {
    responses: {
      '204': {
        description: 'Delete a promotion (admin/publisher)',
      },
    },
  })
  @authenticate('jwt')
  async remove(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ) {
    this.ensureAdminOrPublisher(currentUser);
    await this.ensureCanAccessPromotion(currentUser, id);
    await this.promotionRepository.deleteById(id);
  }

  @get('/promotions/store/active', {
    responses: {
      '200': {
        description: 'Active store-wide promotions (public)',
      },
    },
  })
  async activeStorePromotions() {
    const now = new Date();
    const promos = await this.promotionRepository.find({
      where: {
        scope: 'Store',
        status: 'Active',
      },
      order: ['createdAt DESC'],
    });

    return promos.filter(p => {
      const start = (p as any).startDate ? new Date((p as any).startDate) : null;
      const end = (p as any).endDate
        ? new Date((p as any).endDate)
        : (p as any).expirationDate
          ? new Date((p as any).expirationDate)
          : null;
      if (start && now < start) return false;
      if (end && now > end) return false;
      return true;
    });
  }
}
