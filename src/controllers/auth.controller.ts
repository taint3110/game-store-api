import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {post, requestBody, HttpErrors} from '@loopback/rest';
import {CustomerAccount, PublisherAccount} from '../models';
import {CustomerAccountRepository, PublisherAccountRepository, AdminAccountRepository} from '../repositories';
import {AuthService, PasswordService} from '../services';
import {Credentials, TokenResponse} from '../types';

export class AuthController {
  constructor(
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @repository(AdminAccountRepository)
    public adminAccountRepository: AdminAccountRepository,
    @inject('services.AuthService')
    public authService: AuthService,
    @inject('services.PasswordService')
    public passwordService: PasswordService,
  ) {}

  @post('/auth/customer/register', {
    responses: {
      '201': {
        description: 'Customer account created',
        content: {'application/json': {schema: {'x-ts-type': CustomerAccount}}},
      },
    },
  })
  async registerCustomer(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'phoneNumber', 'username', 'password'],
            properties: {
              email: {type: 'string', format: 'email'},
              phoneNumber: {type: 'string', pattern: '^(0|\\+84)[0-9]{9,10}$'},
              username: {type: 'string', minLength: 3, maxLength: 50},
              password: {type: 'string', minLength: 8},
              genderId: {type: 'string'},
            },
          },
        },
      },
    })
    customerData: Omit<CustomerAccount, 'id'>,
  ): Promise<Omit<CustomerAccount, 'password'>> {
    // Check for duplicate email
    const existingEmail = await this.customerAccountRepository.findByEmail(customerData.email);
    if (existingEmail) {
      throw new HttpErrors.Conflict('Email already exists');
    }

    // Check for duplicate phone number
    const existingPhone = await this.customerAccountRepository.findByPhoneNumber(
      customerData.phoneNumber,
    );
    if (existingPhone) {
      throw new HttpErrors.Conflict('Phone number already exists');
    }

    // Hash password
    const hashedPassword = await this.passwordService.hashPassword(customerData.password);

    // Create customer account
    const customer = await this.customerAccountRepository.create({
      ...customerData,
      password: hashedPassword,
      accountStatus: 'Active',
      accountBalance: 0,
      registrationDate: new Date(),
    });

    // Remove password from response
    const customerJson = customer.toJSON() as any;
    delete customerJson.password;
    return customerJson;
  }

  @post('/auth/customer/login', {
    responses: {
      '200': {
        description: 'Customer login successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {type: 'string'},
                user: {type: 'object'},
              },
            },
          },
        },
      },
    },
  })
  async loginCustomer(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {type: 'string'},
              password: {type: 'string'},
            },
          },
        },
      },
    })
    credentials: Credentials,
  ): Promise<TokenResponse> {
    const userProfile = await this.authService.verifyCustomerCredentials(
      credentials.email,
      credentials.password,
    );

    const token = this.authService.generateToken(userProfile);

    return {
      token,
      user: userProfile,
    };
  }

  @post('/auth/publisher/register', {
    responses: {
      '201': {
        description: 'Publisher account created',
        content: {'application/json': {schema: {'x-ts-type': PublisherAccount}}},
      },
    },
  })
  async registerPublisher(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: [
              'publisherName',
              'email',
              'phoneNumber',
              'password',
              'contractDate',
              'contractDuration',
            ],
            properties: {
              publisherName: {type: 'string'},
              email: {type: 'string', format: 'email'},
              phoneNumber: {type: 'string'},
              password: {type: 'string', minLength: 8},
              contractDate: {type: 'string', format: 'date'},
              contractDuration: {type: 'number', minimum: 1},
              socialMedia: {type: 'string'},
              bankType: {type: 'string'},
              bankName: {type: 'string'},
            },
          },
        },
      },
    })
    publisherData: Omit<PublisherAccount, 'id'>,
  ): Promise<Omit<PublisherAccount, 'password'>> {
    // Check for duplicate email across all account types
    const existingCustomer = await this.customerAccountRepository.findByEmail(publisherData.email);
    const existingPublisher = await this.publisherAccountRepository.findByEmail(
      publisherData.email,
    );
    const existingAdmin = await this.adminAccountRepository.findByEmail(publisherData.email);

    if (existingCustomer || existingPublisher || existingAdmin) {
      throw new HttpErrors.Conflict('Email already exists');
    }

    // Hash password
    const hashedPassword = await this.passwordService.hashPassword(publisherData.password);

    // Create publisher account
    const publisher = await this.publisherAccountRepository.create({
      ...publisherData,
      password: hashedPassword,
      activityStatus: 'Active',
    });

    // Remove password from response
    const publisherJson = publisher.toJSON() as any;
    delete publisherJson.password;
    return publisherJson;
  }

  @post('/auth/publisher/login', {
    responses: {
      '200': {
        description: 'Publisher login successful',
      },
    },
  })
  async loginPublisher(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {type: 'string'},
              password: {type: 'string'},
            },
          },
        },
      },
    })
    credentials: Credentials,
  ): Promise<TokenResponse> {
    const userProfile = await this.authService.verifyPublisherCredentials(
      credentials.email,
      credentials.password,
    );

    const token = this.authService.generateToken(userProfile);

    return {
      token,
      user: userProfile,
    };
  }

  @post('/auth/admin/login', {
    responses: {
      '200': {
        description: 'Admin login successful',
      },
    },
  })
  async loginAdmin(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {type: 'string'},
              password: {type: 'string'},
            },
          },
        },
      },
    })
    credentials: Credentials,
  ): Promise<TokenResponse> {
    const userProfile = await this.authService.verifyAdminCredentials(
      credentials.email,
      credentials.password,
    );

    const token = this.authService.generateToken(userProfile);

    return {
      token,
      user: userProfile,
    };
  }
}
