import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {promisify} from 'util';
import {TokenService} from '@loopback/authentication';
import {TokenServiceBindings} from '@loopback/authentication-jwt';
import {AdminAccountRepository, CustomerAccountRepository, PublisherAccountRepository} from '../repositories';

const jwt = require('jsonwebtoken');
const verifyAsync = promisify(jwt.verify);
const signAsync = promisify(jwt.sign);

export class JWTService implements TokenService {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SECRET)
    private jwtSecret: string,
    @inject(TokenServiceBindings.TOKEN_EXPIRES_IN)
    private jwtExpiresIn: string,
    @repository(CustomerAccountRepository)
    private customerAccountRepository: CustomerAccountRepository,
    @repository(PublisherAccountRepository)
    private publisherAccountRepository: PublisherAccountRepository,
    @repository(AdminAccountRepository)
    private adminAccountRepository: AdminAccountRepository,
  ) {}

  async verifyToken(token: string): Promise<UserProfile> {
    if (!token) {
      throw new HttpErrors.Unauthorized('Token is required');
    }

    let userProfile: UserProfile;

    try {
      const decodedToken = await verifyAsync(token, this.jwtSecret);
      
      userProfile = {
        [securityId]: decodedToken.sub,
        id: decodedToken.sub,
        email: decodedToken.email,
        username: decodedToken.username,
        accountType: decodedToken.accountType,
        role: decodedToken.role,
      };
    } catch (error) {
      throw new HttpErrors.Unauthorized(`Error verifying token : ${error.message}`);
    }

    // Enforce account lock across all API calls (admins are always allowed).
    const accountType = String((userProfile as any)?.accountType ?? '').toLowerCase();
    const userId = String((userProfile as any)?.id ?? '');
    if (!userId) throw new HttpErrors.Unauthorized('Invalid token');

    if (accountType === 'customer') {
      const customer = await this.customerAccountRepository.findById(userId).catch(() => null);
      if (!customer) throw new HttpErrors.Unauthorized('Account not found');
      if (String((customer as any).accountStatus) !== 'Active') {
        throw new HttpErrors.Unauthorized('Account is not active');
      }
    }

    if (accountType === 'publisher') {
      const publisher = await this.publisherAccountRepository.findById(userId).catch(() => null);
      if (!publisher) throw new HttpErrors.Unauthorized('Account not found');
      if (String((publisher as any).activityStatus) !== 'Active') {
        throw new HttpErrors.Unauthorized('Account is not active');
      }
    }

    if (accountType === 'admin') {
      // Best-effort: if admin was deleted, reject. (Admins cannot be locked.)
      const admin = await this.adminAccountRepository.findById(userId).catch(() => null);
      if (!admin) throw new HttpErrors.Unauthorized('Account not found');
    }

    return userProfile;
  }

  async generateToken(userProfile: UserProfile): Promise<string> {
    if (!userProfile) {
      throw new HttpErrors.Unauthorized('User profile is required');
    }

    const payload = {
      sub: userProfile.id,
      email: userProfile.email,
      username: userProfile.username,
      accountType: userProfile.accountType,
      role: userProfile.role,
    };

    let token: string;
    try {
      token = await signAsync(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
      });
    } catch (error) {
      throw new HttpErrors.Unauthorized(`Error generating token : ${error.message}`);
    }

    return token;
  }
}
