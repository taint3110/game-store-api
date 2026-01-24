import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, HttpErrors, patch, requestBody} from '@loopback/rest';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {PublisherAccountRepository, GameRepository} from '../repositories';

type PatchPublisherMeBody = {
  publisherName?: string;
  phoneNumber?: string;
  socialMedia?: string;
  bankType?: string;
  bankName?: string;
};

export class PublisherAccountController {
  constructor(
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @repository(GameRepository)
    public gameRepository: GameRepository,
  ) {}

  private ensurePublisher(currentUser: UserProfile) {
    if ((currentUser as any)?.accountType !== 'publisher') {
      throw new HttpErrors.Forbidden('Publisher access required');
    }
  }

  private async safeMe(publisherId: string) {
    const publisher = await this.publisherAccountRepository.findById(publisherId);
    const json = publisher.toJSON() as any;
    delete json.password;
    return json;
  }

  @get('/publisher/me', {
    responses: {'200': {description: 'Get current publisher profile'}},
  })
  @authenticate('jwt')
  async me(@inject(SecurityBindings.USER) currentUser: UserProfile) {
    this.ensurePublisher(currentUser);
    const publisherId = String(currentUser[securityId]);
    return this.safeMe(publisherId);
  }

  @patch('/publisher/me', {
    responses: {'200': {description: 'Update current publisher profile'}},
  })
  @authenticate('jwt')
  async patchMe(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              publisherName: {type: 'string', minLength: 2, maxLength: 80},
              phoneNumber: {type: 'string', minLength: 6, maxLength: 30},
              socialMedia: {type: 'string', maxLength: 200},
              bankType: {type: 'string', maxLength: 80},
              bankName: {type: 'string', maxLength: 120},
            },
          },
        },
      },
    })
    body: PatchPublisherMeBody,
  ) {
    this.ensurePublisher(currentUser);
    const publisherId = String(currentUser[securityId]);

    const patch: any = {updatedAt: new Date()};
    if (typeof body.publisherName === 'string') patch.publisherName = body.publisherName.trim();
    if (typeof body.phoneNumber === 'string') patch.phoneNumber = body.phoneNumber.trim();
    if (typeof body.socialMedia === 'string') patch.socialMedia = body.socialMedia.trim();
    if (typeof body.bankType === 'string') patch.bankType = body.bankType.trim();
    if (typeof body.bankName === 'string') patch.bankName = body.bankName.trim();

    await this.publisherAccountRepository.updateById(publisherId, patch);
    return this.safeMe(publisherId);
  }

  @get('/publisher/me/contract', {
    responses: {'200': {description: 'Publisher contract info'}},
  })
  @authenticate('jwt')
  async contract(@inject(SecurityBindings.USER) currentUser: UserProfile) {
    this.ensurePublisher(currentUser);
    const publisherId = String(currentUser[securityId]);
    const publisher = await this.publisherAccountRepository.findById(publisherId);

    const contractDate = (publisher as any).contractDate ? new Date((publisher as any).contractDate) : new Date();
    const duration = Number((publisher as any).contractDuration ?? 0) || 0;
    const expiryDate = new Date(contractDate);
    expiryDate.setMonth(expiryDate.getMonth() + Math.max(0, duration));

    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const isActive = String((publisher as any).activityStatus) === 'Active' && daysRemaining >= 0;

    return {
      contractDate,
      contractDuration: duration,
      expiryDate,
      activityStatus: (publisher as any).activityStatus,
      isActive,
      daysRemaining,
      isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 30,
    };
  }

  @get('/publisher/me/games/counts', {
    responses: {'200': {description: 'Publisher game counts by status'}},
  })
  @authenticate('jwt')
  async gameCounts(@inject(SecurityBindings.USER) currentUser: UserProfile) {
    this.ensurePublisher(currentUser);
    const publisherId = String(currentUser[securityId]);

    const [total, released, upcoming, delisted] = await Promise.all([
      this.gameRepository.count({publisherId} as any),
      this.gameRepository.count({publisherId, releaseStatus: 'Released'} as any),
      this.gameRepository.count({publisherId, releaseStatus: 'Upcoming'} as any),
      this.gameRepository.count({publisherId, releaseStatus: 'Delisted'} as any),
    ]);

    return {
      totalGames: total.count,
      releasedGames: released.count,
      upcomingGames: upcoming.count,
      delistedGames: delisted.count,
    };
  }
}

