import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, patch, post, param, requestBody, HttpErrors} from '@loopback/rest';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {GameRepository, ReviewRepository, ReportRepository, SteamAppRepository} from '../repositories';

type CreateReportBody = {
  targetType: 'game' | 'review';
  targetId: string;
  targetGameType?: 'steam' | 'custom';
  reasonCategory?: string;
  reasonText: string;
};

type AdminPatchBody = {
  status: 'Pending' | 'Resolved' | 'Rejected';
  resolutionNote?: string;
};

export class ReportController {
  constructor(
    @repository(ReportRepository)
    public reportRepository: ReportRepository,
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(SteamAppRepository)
    public steamAppRepository: SteamAppRepository,
    @repository(ReviewRepository)
    public reviewRepository: ReviewRepository,
  ) {}

  private static ensureAccountType(currentUser: UserProfile, expected: 'customer' | 'publisher') {
    if ((currentUser as any)?.accountType !== expected) {
      throw new HttpErrors.Forbidden(`${expected} access required`);
    }
  }

  private static ensureAdmin(currentUser: UserProfile) {
    if ((currentUser as any)?.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }
  }

  private normalizeTargetId(targetId: unknown): string {
    return String(targetId ?? '').trim();
  }

  private async ensureTargetExists(body: CreateReportBody) {
    const targetId = this.normalizeTargetId(body.targetId);
    if (!targetId) throw new HttpErrors.UnprocessableEntity('targetId is required');

    if (body.targetType === 'review') {
      await this.reviewRepository.findById(targetId);
      return;
    }

    if (body.targetType !== 'game') {
      throw new HttpErrors.UnprocessableEntity('targetType must be game or review');
    }

    if (!body.targetGameType) {
      throw new HttpErrors.UnprocessableEntity('targetGameType is required for game reports');
    }

    if (body.targetGameType === 'custom') {
      await this.gameRepository.findById(targetId);
      return;
    }

    if (body.targetGameType === 'steam') {
      const steamId = Number(targetId);
      if (!Number.isFinite(steamId) || steamId <= 0) {
        throw new HttpErrors.UnprocessableEntity('For steam game reports, targetId must be a valid steam app id');
      }
      const exists = await this.steamAppRepository.findOne({where: {steamAppId: steamId}});
      if (!exists) throw new HttpErrors.NotFound('Steam app not found');
      return;
    }

    throw new HttpErrors.UnprocessableEntity('Invalid targetGameType');
  }

  private async buildMetadata(body: CreateReportBody): Promise<Record<string, any>> {
    const targetId = this.normalizeTargetId(body.targetId);

    if (body.targetType === 'review') {
      const review = await this.reviewRepository.findById(targetId);
      const anyReview = review as any;
      const text = String(anyReview?.text ?? anyReview?.comment ?? '').trim();
      return {
        reviewGameId: String(anyReview?.gameId ?? ''),
        reviewRating: Number(anyReview?.rating ?? 0),
        reviewSnippet: text.slice(0, 120),
      };
    }

    if (body.targetType === 'game' && body.targetGameType === 'custom') {
      const game = await this.gameRepository.findById(targetId);
      const anyGame = game as any;
      return {
        gameType: 'custom',
        gameName: anyGame?.name,
        gameImageUrl: anyGame?.imageUrl,
        publisherId: anyGame?.publisherId,
      };
    }

    if (body.targetType === 'game' && body.targetGameType === 'steam') {
      const steamId = Number(targetId);
      const app = await this.steamAppRepository.findOne({where: {steamAppId: steamId}});
      return {
        gameType: 'steam',
        steamAppId: steamId,
        gameName: (app as any)?.name,
        gameImageUrl: (app as any)?.avatarUrl,
      };
    }

    return {};
  }

  private async createReportFor(
    currentUser: UserProfile,
    reporterAccountType: 'customer' | 'publisher',
    body: CreateReportBody,
  ) {
    const reporterId = String(currentUser[securityId]);
    const targetId = this.normalizeTargetId(body.targetId);
    const reasonText = String(body.reasonText ?? '').trim();
    if (reasonText.length < 10) {
      throw new HttpErrors.UnprocessableEntity('reasonText must be at least 10 characters');
    }

    await this.ensureTargetExists({...body, targetId});

    const existing = await this.reportRepository.findOne({
      where: {
        reporterAccountType,
        reporterId,
        targetType: body.targetType,
        targetId,
        status: 'Pending',
      } as any,
    });
    if (existing) {
      throw new HttpErrors.Conflict('You already reported this item and it is still pending');
    }

    const metadata = await this.buildMetadata({...body, targetId});

    return this.reportRepository.create({
      reporterAccountType,
      reporterId,
      targetType: body.targetType,
      targetId,
      targetGameType: body.targetType === 'game' ? body.targetGameType : undefined,
      reasonCategory: body.reasonCategory,
      reasonText,
      status: 'Pending',
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  @post('/customers/me/reports', {
    responses: {'201': {description: 'Create a report (customer)'}},
  })
  @authenticate('jwt')
  async createCustomerReport(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['targetType', 'targetId', 'reasonText'],
            properties: {
              targetType: {type: 'string', enum: ['game', 'review']},
              targetId: {type: 'string'},
              targetGameType: {type: 'string', enum: ['steam', 'custom']},
              reasonCategory: {type: 'string'},
              reasonText: {type: 'string', minLength: 10, maxLength: 2000},
            },
          },
        },
      },
    })
    body: CreateReportBody,
  ) {
    ReportController.ensureAccountType(currentUser, 'customer');
    return this.createReportFor(currentUser, 'customer', body);
  }

  @get('/customers/me/reports', {
    responses: {'200': {description: 'List reports created by current customer'}},
  })
  @authenticate('jwt')
  async listCustomerReports(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('status') status?: string,
    @param.query.number('limit') limit?: number,
    @param.query.number('skip') skip?: number,
  ) {
    ReportController.ensureAccountType(currentUser, 'customer');
    const take = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
    const offset = Math.max(0, Math.floor(Number(skip) || 0));
    const reporterId = String(currentUser[securityId]);
    const where: any = {reporterAccountType: 'customer', reporterId};
    if (status) where.status = String(status);
    return this.reportRepository.find({where, order: ['updatedAt DESC'], limit: take, skip: offset});
  }

  @post('/publisher/me/reports', {
    responses: {'201': {description: 'Create a report (publisher)'}},
  })
  @authenticate('jwt')
  async createPublisherReport(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['targetType', 'targetId', 'reasonText'],
            properties: {
              targetType: {type: 'string', enum: ['game', 'review']},
              targetId: {type: 'string'},
              targetGameType: {type: 'string', enum: ['steam', 'custom']},
              reasonCategory: {type: 'string'},
              reasonText: {type: 'string', minLength: 10, maxLength: 2000},
            },
          },
        },
      },
    })
    body: CreateReportBody,
  ) {
    ReportController.ensureAccountType(currentUser, 'publisher');
    return this.createReportFor(currentUser, 'publisher', body);
  }

  @get('/publisher/me/reports', {
    responses: {'200': {description: 'List reports created by current publisher'}},
  })
  @authenticate('jwt')
  async listPublisherReports(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('status') status?: string,
    @param.query.number('limit') limit?: number,
    @param.query.number('skip') skip?: number,
  ) {
    ReportController.ensureAccountType(currentUser, 'publisher');
    const take = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
    const offset = Math.max(0, Math.floor(Number(skip) || 0));
    const reporterId = String(currentUser[securityId]);
    const where: any = {reporterAccountType: 'publisher', reporterId};
    if (status) where.status = String(status);
    return this.reportRepository.find({where, order: ['updatedAt DESC'], limit: take, skip: offset});
  }

  @get('/admin/reports', {
    responses: {'200': {description: 'List reports (admin)'}},
  })
  @authenticate('jwt')
  async listReports(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('status') status?: string,
    @param.query.string('targetType') targetType?: string,
    @param.query.number('limit') limit?: number,
    @param.query.number('skip') skip?: number,
  ) {
    ReportController.ensureAdmin(currentUser);
    const take = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
    const offset = Math.max(0, Math.floor(Number(skip) || 0));
    const where: any = {};
    if (status) where.status = String(status);
    if (targetType) where.targetType = String(targetType);
    return this.reportRepository.find({where, order: ['updatedAt DESC'], limit: take, skip: offset});
  }

  @get('/admin/reports/{id}', {
    responses: {'200': {description: 'Report detail (admin)'}},
  })
  @authenticate('jwt')
  async getReport(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ) {
    ReportController.ensureAdmin(currentUser);
    return this.reportRepository.findById(id);
  }

  @patch('/admin/reports/{id}', {
    responses: {'200': {description: 'Update report status (admin)'}},
  })
  @authenticate('jwt')
  async updateReport(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['status'],
            properties: {
              status: {type: 'string', enum: ['Pending', 'Resolved', 'Rejected']},
              resolutionNote: {type: 'string', maxLength: 2000},
            },
          },
        },
      },
    })
    body: AdminPatchBody,
  ) {
    ReportController.ensureAdmin(currentUser);

    const existing = await this.reportRepository.findById(id);
    const status = body.status;
    const patch: any = {
      status,
      resolutionNote: body.resolutionNote,
      updatedAt: new Date(),
    };

    if (status === 'Resolved' || status === 'Rejected') {
      patch.resolvedAt = new Date();
      patch.resolvedByAdminId = String((currentUser as any)?.id || currentUser[securityId]);
    } else {
      patch.resolvedAt = undefined;
      patch.resolvedByAdminId = undefined;
    }

    await this.reportRepository.updateById(existing.id!, patch);
    return this.reportRepository.findById(existing.id!);
  }
}

