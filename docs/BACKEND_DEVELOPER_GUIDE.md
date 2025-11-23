# Backend Developer Guide - LoopBack 4

## Table of Contents
- [Introduction to LoopBack 4](#introduction-to-loopback-4)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
- [Development Workflow](#development-workflow)
- [Common Tasks](#common-tasks)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Introduction to LoopBack 4

LoopBack 4 is a highly extensible Node.js and TypeScript framework for building APIs and microservices. It follows a modular architecture with dependency injection at its core.

### Key Features
- **TypeScript-first**: Strong typing and modern JavaScript features
- **Dependency Injection**: IoC container for managing dependencies
- **OpenAPI Integration**: Auto-generated API documentation
- **Extensibility**: Decorators, interceptors, and custom components
- **Repository Pattern**: Clean data access layer

---

## Project Structure

```
game-store-api/
├── src/
│   ├── controllers/          # API endpoints
│   │   ├── auth.controller.ts
│   │   ├── game.controller.ts
│   │   ├── customer-account.controller.ts
│   │   ├── admin-account.controller.ts
│   │   └── admin-management.controller.ts
│   ├── models/               # Data models
│   │   ├── game.model.ts
│   │   ├── customer-account.model.ts
│   │   └── admin-account.model.ts
│   ├── repositories/         # Data access layer
│   │   ├── game.repository.ts
│   │   └── customer-account.repository.ts
│   ├── services/             # Business logic
│   │   ├── auth.service.ts
│   │   ├── password.service.ts
│   │   └── jwt.service.ts
│   ├── datasources/          # Database connections
│   │   └── mongodb.datasource.ts
│   ├── interceptors/         # Request/response interceptors
│   │   └── authorize.interceptor.ts
│   ├── types/                # TypeScript type definitions
│   │   └── auth.types.ts
│   ├── application.ts        # Application configuration
│   ├── sequence.ts           # Request handling sequence
│   └── index.ts              # Entry point
├── .env                      # Environment variables
├── package.json
└── tsconfig.json
```

---

## Core Concepts

### 1. Models

Models define the structure of your data. They use decorators to specify properties and relationships.

**Example: Game Model**
```typescript
import {Entity, model, property, belongsTo} from '@loopback/repository';
import {PublisherAccount} from './publisher-account.model';

@model({
  settings: {
    mongodb: {collection: 'games'},
  },
})
export class Game extends Entity {
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
  })
  name: string;

  @property({
    type: 'number',
    required: true,
  })
  originalPrice: number;

  @belongsTo(() => PublisherAccount)
  publisherId: string;

  constructor(data?: Partial<Game>) {
    super(data);
  }
}
```

**Key Decorators:**
- `@model()`: Marks a class as a model
- `@property()`: Defines a property with validation rules
- `@belongsTo()`: Defines a many-to-one relationship
- `@hasMany()`: Defines a one-to-many relationship
- `@hasOne()`: Defines a one-to-one relationship

### 2. Repositories

Repositories provide CRUD operations and custom queries for models.

**Example: Game Repository**
```typescript
import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {Game, GameRelations, PublisherAccount} from '../models';
import {PublisherAccountRepository} from './publisher-account.repository';

export class GameRepository extends DefaultCrudRepository<
  Game,
  typeof Game.prototype.id,
  GameRelations
> {
  public readonly publisher: BelongsToAccessor<
    PublisherAccount,
    typeof Game.prototype.id
  >;

  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
    @repository.getter('PublisherAccountRepository')
    protected publisherRepositoryGetter: Getter<PublisherAccountRepository>,
  ) {
    super(Game, dataSource);
    
    // Setup relationship
    this.publisher = this.createBelongsToAccessorFor(
      'publisher',
      publisherRepositoryGetter,
    );
    this.registerInclusionResolver('publisher', this.publisher.inclusionResolver);
  }

  // Custom methods
  async findByGenre(genre: string): Promise<Game[]> {
    return this.find({where: {genre}});
  }

  async findActiveGames(): Promise<Game[]> {
    return this.find({where: {releaseStatus: 'Released'}});
  }
}
```

**Built-in Methods:**
- `create(data)`: Create a new record
- `find(filter)`: Find multiple records
- `findById(id)`: Find by ID
- `findOne(filter)`: Find single record
- `updateById(id, data)`: Update by ID
- `deleteById(id)`: Delete by ID
- `count(where)`: Count records

### 3. Controllers

Controllers define API endpoints and handle HTTP requests.

**Example: Game Controller**
```typescript
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, post, patch, del, param, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {Game} from '../models';
import {GameRepository} from '../repositories';

export class GameController {
  constructor(
    @repository(GameRepository)
    public gameRepository: GameRepository,
  ) {}

  @get('/games', {
    responses: {
      '200': {
        description: 'Array of Game model instances',
        content: {
          'application/json': {
            schema: {type: 'array', items: {'x-ts-type': Game}},
          },
        },
      },
    },
  })
  async find(
    @param.query.string('genre') genre?: string,
  ): Promise<Game[]> {
    const where: any = {releaseStatus: 'Released'};
    
    if (genre) {
      where.genre = genre;
    }

    return this.gameRepository.find({
      where,
      include: [{relation: 'publisher'}],
    });
  }

  @post('/games', {
    responses: {
      '201': {
        description: 'Game model instance',
        content: {'application/json': {schema: {'x-ts-type': Game}}},
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
            required: ['name', 'genre', 'originalPrice'],
            properties: {
              name: {type: 'string'},
              genre: {type: 'string'},
              originalPrice: {type: 'number', minimum: 0},
            },
          },
        },
      },
    })
    gameData: Omit<Game, 'id'>,
  ): Promise<Game> {
    // Authorization check
    if (currentUser.accountType !== 'publisher' && currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Only publishers and admins can create games');
    }

    const publisherId = currentUser.accountType === 'admin' 
      ? (gameData as any).publisherId || currentUser[securityId]
      : currentUser[securityId];

    return this.gameRepository.create({
      ...gameData,
      publisherId,
      releaseStatus: 'Released',
    });
  }
}
```

**Key Decorators:**
- `@get()`, `@post()`, `@patch()`, `@put()`, `@del()`: HTTP methods
- `@param.path.string()`: Path parameter
- `@param.query.string()`: Query parameter
- `@requestBody()`: Request body with validation
- `@authenticate()`: Require authentication

### 4. Services

Services contain business logic and can be injected into controllers.

**Example: Auth Service**
```typescript
import {injectable, inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId} from '@loopback/security';
import {CustomerAccountRepository} from '../repositories';
import {PasswordService} from './password.service';
import {UserProfile} from '../types';

@injectable()
export class AuthService {
  constructor(
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @inject('services.PasswordService')
    public passwordService: PasswordService,
  ) {}

  async verifyCustomerCredentials(
    email: string,
    password: string,
  ): Promise<UserProfile> {
    const customer = await this.customerAccountRepository.findByEmail(email);
    
    if (!customer) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      password,
      customer.password,
    );
    
    if (!isPasswordValid) {
      throw new HttpErrors.Unauthorized('Invalid credentials');
    }

    return {
      [securityId]: customer.id!,
      id: customer.id!,
      email: customer.email,
      accountType: 'customer',
    };
  }
}
```

### 5. Dependency Injection

LoopBack 4 uses dependency injection to manage dependencies.

**Injecting Repositories:**
```typescript
constructor(
  @repository(GameRepository)
  public gameRepository: GameRepository,
) {}
```

**Injecting Services:**
```typescript
constructor(
  @inject('services.AuthService')
  public authService: AuthService,
) {}
```

**Injecting Current User:**
```typescript
async myMethod(
  @inject(SecurityBindings.USER) currentUser: UserProfile,
) {
  const userId = currentUser[securityId];
}
```

### 6. Authentication & Authorization

**Setup in application.ts:**
```typescript
import {AuthenticationComponent} from '@loopback/authentication';
import {JWTAuthenticationComponent, TokenServiceBindings} from '@loopback/authentication-jwt';

export class GameStoreApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Add authentication
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);

    // Configure JWT
    this.bind(TokenServiceBindings.TOKEN_SECRET).to(
      process.env.JWT_SECRET || 'dev-secret',
    );
    this.bind(TokenServiceBindings.TOKEN_EXPIRES_IN).to('7d');

    // Use custom JWT service
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService);
  }
}
```

**Custom JWT Service:**
```typescript
import {inject} from '@loopback/core';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {TokenService} from '@loopback/authentication';
import {TokenServiceBindings} from '@loopback/authentication-jwt';

const jwt = require('jsonwebtoken');
const {promisify} = require('util');
const verifyAsync = promisify(jwt.verify);
const signAsync = promisify(jwt.sign);

export class JWTService implements TokenService {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SECRET)
    private jwtSecret: string,
    @inject(TokenServiceBindings.TOKEN_EXPIRES_IN)
    private jwtExpiresIn: string,
  ) {}

  async verifyToken(token: string): Promise<UserProfile> {
    const decodedToken = await verifyAsync(token, this.jwtSecret);
    
    return {
      [securityId]: decodedToken.sub,
      id: decodedToken.sub,
      email: decodedToken.email,
      accountType: decodedToken.accountType,
      role: decodedToken.role,
    };
  }

  async generateToken(userProfile: UserProfile): Promise<string> {
    const payload = {
      sub: userProfile.id,
      email: userProfile.email,
      accountType: userProfile.accountType,
      role: userProfile.role,
    };

    return signAsync(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }
}
```

---

## Development Workflow

### 1. Create a New Model

```bash
lb4 model
```

Or manually create in `src/models/`:

```typescript
import {Entity, model, property} from '@loopback/repository';

@model()
export class MyModel extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  constructor(data?: Partial<MyModel>) {
    super(data);
  }
}
```

### 2. Create a Repository

```bash
lb4 repository
```

Or manually:

```typescript
import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongodbDataSource} from '../datasources';
import {MyModel, MyModelRelations} from '../models';

export class MyModelRepository extends DefaultCrudRepository<
  MyModel,
  typeof MyModel.prototype.id,
  MyModelRelations
> {
  constructor(
    @inject('datasources.mongodb') dataSource: MongodbDataSource,
  ) {
    super(MyModel, dataSource);
  }
}
```

### 3. Create a Controller

```bash
lb4 controller
```

Or manually:

```typescript
import {repository} from '@loopback/repository';
import {get, post, requestBody} from '@loopback/rest';
import {MyModel} from '../models';
import {MyModelRepository} from '../repositories';

export class MyModelController {
  constructor(
    @repository(MyModelRepository)
    public myModelRepository: MyModelRepository,
  ) {}

  @get('/my-models')
  async find(): Promise<MyModel[]> {
    return this.myModelRepository.find();
  }

  @post('/my-models')
  async create(
    @requestBody() data: Omit<MyModel, 'id'>,
  ): Promise<MyModel> {
    return this.myModelRepository.create(data);
  }
}
```

### 4. Create a Service

```bash
lb4 service
```

Or manually in `src/services/`:

```typescript
import {injectable} from '@loopback/core';

@injectable()
export class MyService {
  async doSomething(): Promise<string> {
    return 'Done!';
  }
}
```

Register in `src/application.ts`:

```typescript
import {MyService} from './services';

this.service(MyService);
```

---

## Common Tasks

### Add Validation to Model

```typescript
@property({
  type: 'string',
  required: true,
  jsonSchema: {
    minLength: 3,
    maxLength: 50,
    pattern: '^[a-zA-Z0-9]+$',
  },
})
username: string;

@property({
  type: 'string',
  required: true,
  jsonSchema: {
    format: 'email',
  },
})
email: string;

@property({
  type: 'number',
  required: true,
  jsonSchema: {
    minimum: 0,
    maximum: 1000,
  },
})
price: number;
```

### Add Relationships

**BelongsTo (Many-to-One):**
```typescript
// In Game model
@belongsTo(() => PublisherAccount)
publisherId: string;

// In repository
this.publisher = this.createBelongsToAccessorFor(
  'publisher',
  publisherRepositoryGetter,
);
this.registerInclusionResolver('publisher', this.publisher.inclusionResolver);
```

**HasMany (One-to-Many):**
```typescript
// In Publisher model
@hasMany(() => Game)
games: Game[];

// In repository
this.games = this.createHasManyRepositoryFactoryFor(
  'games',
  gameRepositoryGetter,
);
this.registerInclusionResolver('games', this.games.inclusionResolver);
```

### Query with Filters

```typescript
// Find with conditions
await this.gameRepository.find({
  where: {
    genre: 'RPG',
    originalPrice: {lt: 60},
  },
  order: ['name ASC'],
  limit: 10,
  skip: 0,
});

// Include relations
await this.gameRepository.find({
  include: [
    {relation: 'publisher'},
    {
      relation: 'reviews',
      scope: {
        where: {rating: {gte: 4}},
      },
    },
  ],
});

// Count
const count = await this.gameRepository.count({genre: 'RPG'});
```

### Handle Errors

```typescript
import {HttpErrors} from '@loopback/rest';

// 400 Bad Request
throw new HttpErrors.BadRequest('Invalid input');

// 401 Unauthorized
throw new HttpErrors.Unauthorized('Invalid credentials');

// 403 Forbidden
throw new HttpErrors.Forbidden('Insufficient permissions');

// 404 Not Found
throw new HttpErrors.NotFound('Resource not found');

// 409 Conflict
throw new HttpErrors.Conflict('Email already exists');

// 422 Unprocessable Entity
throw new HttpErrors.UnprocessableEntity('Validation failed');

// 500 Internal Server Error
throw new HttpErrors.InternalServerError('Something went wrong');
```

### Add Custom Methods to Repository

```typescript
export class GameRepository extends DefaultCrudRepository<...> {
  async findByGenre(genre: string): Promise<Game[]> {
    return this.find({where: {genre}});
  }

  async findPopularGames(limit: number = 10): Promise<Game[]> {
    return this.find({
      where: {releaseStatus: 'Released'},
      order: ['averageRating DESC'],
      limit,
    });
  }

  async updatePrice(id: string, newPrice: number): Promise<void> {
    await this.updateById(id, {
      discountPrice: newPrice,
      updatedAt: new Date(),
    });
  }
}
```

### Create Interceptors

```typescript
import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';

@injectable({tags: {key: 'interceptors.logging'}})
export class LoggingInterceptor implements Provider<Interceptor> {
  value() {
    return this.intercept.bind(this);
  }

  async intercept(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<InvocationResult>,
  ) {
    console.log('Before:', invocationCtx.methodName);
    const result = await next();
    console.log('After:', invocationCtx.methodName);
    return result;
  }
}
```

Register in controller:
```typescript
@intercept('interceptors.logging')
export class MyController {
  // ...
}
```

---

## Best Practices

### 1. Model Design
- Use meaningful property names
- Add validation rules in the model
- Document complex properties
- Use enums for fixed values
- Set appropriate default values

### 2. Repository Pattern
- Keep repositories focused on data access
- Add custom query methods to repositories
- Use transactions for complex operations
- Handle errors appropriately

### 3. Controller Design
- Keep controllers thin (delegate to services)
- Use proper HTTP status codes
- Validate input thoroughly
- Document endpoints with OpenAPI specs
- Handle errors gracefully

### 4. Service Layer
- Put business logic in services
- Make services reusable
- Use dependency injection
- Keep services testable
- Avoid tight coupling

### 5. Security
- Always validate and sanitize input
- Use parameterized queries (built-in with LoopBack)
- Implement proper authentication
- Use role-based authorization
- Never expose sensitive data
- Hash passwords (use bcrypt)
- Use environment variables for secrets

### 6. Performance
- Use indexes on frequently queried fields
- Limit query results
- Use pagination
- Cache when appropriate
- Avoid N+1 queries (use include)

### 7. Code Organization
- Follow consistent naming conventions
- Group related functionality
- Keep files focused and small
- Use TypeScript types effectively
- Write self-documenting code

---

## Troubleshooting

### Common Issues

#### 1. "Cannot find module" Error
**Solution:** Run `npm install` and rebuild:
```bash
npm install
npm run build
```

#### 2. Authentication Not Working
**Check:**
- JWT secret is configured correctly
- Token is included in Authorization header
- Token hasn't expired
- Custom JWT service is properly bound

#### 3. Relationship Not Loading
**Solution:** Register inclusion resolver:
```typescript
this.registerInclusionResolver('relationName', this.relation.inclusionResolver);
```

#### 4. Validation Errors
**Check:**
- Request body matches schema
- Required fields are provided
- Data types are correct
- Validation rules are met

#### 5. Database Connection Issues
**Check:**
- MongoDB is running
- Connection string is correct in .env
- Network connectivity
- Database credentials

### Debugging Tips

1. **Enable Debug Logging:**
```bash
DEBUG=loopback:* npm start
```

2. **Check API Explorer:**
Visit `http://localhost:3000/explorer` to test endpoints

3. **Use Console Logging:**
```typescript
console.log('Debug:', JSON.stringify(data, null, 2));
```

4. **Check Request/Response:**
Use browser DevTools or Postman to inspect HTTP traffic

5. **Verify Environment Variables:**
```typescript
console.log('JWT_SECRET:', process.env.JWT_SECRET);
```

---

## Testing

### Unit Tests

```typescript
import {expect} from '@loopback/testlab';
import {GameRepository} from '../repositories';
import {testdb} from './fixtures/datasources/testdb.datasource';

describe('GameRepository', () => {
  let repository: GameRepository;

  before(async () => {
    repository = new GameRepository(testdb);
  });

  it('creates a game', async () => {
    const game = await repository.create({
      name: 'Test Game',
      genre: 'RPG',
      originalPrice: 59.99,
    });

    expect(game.id).to.not.be.undefined();
    expect(game.name).to.equal('Test Game');
  });
});
```

### Integration Tests

```typescript
import {Client, expect} from '@loopback/testlab';
import {GameStoreApplication} from '../application';
import {setupApplication} from './test-helper';

describe('GameController', () => {
  let app: GameStoreApplication;
  let client: Client;

  before('setupApplication', async () => {
    ({app, client} = await setupApplication());
  });

  after(async () => {
    await app.stop();
  });

  it('gets games', async () => {
    const res = await client.get('/games').expect(200);
    expect(res.body).to.be.Array();
  });

  it('creates a game', async () => {
    const res = await client
      .post('/games')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name: 'New Game',
        genre: 'Action',
        originalPrice: 49.99,
      })
      .expect(201);

    expect(res.body.name).to.equal('New Game');
  });
});
```

---

## Additional Resources

- [LoopBack 4 Documentation](https://loopback.io/doc/en/lb4/)
- [LoopBack 4 Examples](https://github.com/loopbackio/loopback-next/tree/master/examples)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [JWT.io](https://jwt.io/)

---

## Quick Reference

### CLI Commands
```bash
# Create model
lb4 model

# Create repository
lb4 repository

# Create controller
lb4 controller

# Create service
lb4 service

# Create datasource
lb4 datasource

# Build project
npm run build

# Start server
npm start

# Run in dev mode
npm run dev

# Run tests
npm test
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
MONGODB_URL=mongodb://localhost:27017/gamestore
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
```

This guide should help you get started with LoopBack 4 development. Happy coding!
