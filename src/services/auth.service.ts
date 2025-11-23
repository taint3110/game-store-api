import {injectable, inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId} from '@loopback/security';
import {sign, SignOptions} from 'jsonwebtoken';
import {CustomerAccountRepository, PublisherAccountRepository, AdminAccountRepository} from '../repositories';
import {PasswordService} from './password.service';
import {UserProfile} from '../types';

@injectable()
export class AuthService {
  constructor(
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @repository(AdminAccountRepository)
    public adminAccountRepository: AdminAccountRepository,
    @inject('services.PasswordService')
    public passwordService: PasswordService,
  ) {}

  async verifyCustomerCredentials(email: string, password: string): Promise<UserProfile> {
    const customer = await this.customerAccountRepository.findByEmail(email);
    
    if (!customer) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    if (customer.accountStatus !== 'Active') {
      throw new HttpErrors.Unauthorized('Account is not active');
    }

    const isPasswordValid = await this.passwordService.comparePassword(password, customer.password);
    
    if (!isPasswordValid) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    return {
      [securityId]: customer.id!,
      id: customer.id!,
      email: customer.email,
      username: customer.username,
      accountType: 'customer',
    };
  }

  async verifyPublisherCredentials(email: string, password: string): Promise<UserProfile> {
    const publisher = await this.publisherAccountRepository.findByEmail(email);
    
    if (!publisher) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    if (publisher.activityStatus !== 'Active') {
      throw new HttpErrors.Unauthorized('Account is not active');
    }

    const isPasswordValid = await this.passwordService.comparePassword(password, publisher.password);
    
    if (!isPasswordValid) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    return {
      [securityId]: publisher.id!,
      id: publisher.id!,
      email: publisher.email,
      username: publisher.publisherName,
      accountType: 'publisher',
    };
  }

  async verifyAdminCredentials(email: string, password: string): Promise<UserProfile> {
    const admin = await this.adminAccountRepository.findByEmail(email);
    
    if (!admin) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.comparePassword(password, admin.password);
    
    if (!isPasswordValid) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    return {
      [securityId]: admin.id!,
      id: admin.id!,
      email: admin.email,
      accountType: 'admin',
    };
  }

  generateToken(userProfile: UserProfile): string {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
    const payload = {
      sub: userProfile.id,
      email: userProfile.email,
      username: userProfile.username,
      accountType: userProfile.accountType,
    };

    const options: SignOptions = {
      expiresIn,
    };

    return sign(payload, secret, options);
  }
}
