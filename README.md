# Game Store API

A REST API built with LoopBack 4 for managing a game store platform with customer accounts, game listings, orders, and reviews.

## Features

- **Multi-Role Authentication**: Customer, Publisher, and Admin accounts with JWT
- **Game Management**: Full CRUD operations with search and filtering
- **Order Processing**: Automated game key assignment and order tracking
- **Review System**: Customer reviews and ratings
- **Admin Dashboard**: Complete platform management and statistics
- **Promotional Offers**: Discount and promotion management
- **MongoDB Integration**: Scalable NoSQL database

## Quick Start

### Prerequisites

- Node.js 18 or 20
- MongoDB 5.0+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URL and JWT secret

# Start the server
npm start
```

The API will be available at `http://localhost:3000`

**API Explorer:** `http://localhost:3000/explorer`

## Documentation

### For Frontend Developers
📘 **[API Documentation](docs/API_DOCUMENTATION.md)**
- Complete API endpoint reference
- Authentication guide
- Request/response examples
- Frontend integration examples (React, Vue, vanilla JS)
- Error handling
- Best practices

### For Backend Developers
📗 **[Backend Developer Guide](docs/BACKEND_DEVELOPER_GUIDE.md)**
- LoopBack 4 architecture overview
- Project structure explained
- Core concepts (Models, Repositories, Controllers, Services)
- Development workflow
- Common tasks and patterns
- Best practices
- Troubleshooting guide

## API Overview

### Authentication Endpoints
- `POST /auth/customer/register` - Register new customer
- `POST /auth/customer/login` - Customer login
- `POST /auth/publisher/register` - Register new publisher
- `POST /auth/publisher/login` - Publisher login
- `POST /auth/admin/login` - Admin login

### Game Endpoints
- `GET /games` - List all games (public)
- `GET /games/{id}` - Get game details
- `POST /games` - Create game (Publisher/Admin)
- `PATCH /games/{id}` - Update game (Publisher/Admin)
- `DELETE /games/{id}` - Delete game (Publisher/Admin)
- `GET /games/{id}/reviews` - Get game reviews

### Customer Endpoints
- `GET /customers/me` - Get profile
- `PATCH /customers/me` - Update profile
- `POST /customers/me/change-password` - Change password
- `GET /customers/me/orders` - Get order history

### Admin Endpoints
- `GET /admin/customers` - Manage customers
- `GET /admin/publishers` - Manage publishers
- `GET /admin/orders` - View all orders
- `GET /admin/games` - View all games
- `GET /admin/reviews` - Manage reviews
- `GET /admin/statistics` - Platform statistics

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
│   ├── services/             # Business logic
│   │   ├── auth.service.ts
│   │   ├── password.service.ts
│   │   └── jwt.service.ts
│   ├── datasources/          # Database connections
│   ├── interceptors/         # Request interceptors
│   ├── types/                # TypeScript types
│   ├── application.ts        # App configuration
│   └── index.ts              # Entry point
├── docs/                     # Documentation
│   ├── API_DOCUMENTATION.md
│   └── BACKEND_DEVELOPER_GUIDE.md
├── .env                      # Environment variables
└── package.json
```

## Environment Variables

```env
NODE_ENV=development
PORT=3000
MONGODB_URL=mongodb://localhost:27017/gamestore
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
LOG_LEVEL=debug
```

## Development

```bash
# Start in development mode with auto-reload
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run prettier
```

## Docker Support

```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run

# Or use docker-compose
docker-compose up
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "GameController"
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (Customer, Publisher, Admin)
- Input validation and sanitization
- MongoDB injection prevention
- Secure environment variable management

## Admin Roles

- **SuperAdmin**: Full system access, can create/delete admins
- **Admin**: Manage users, games, orders, and reviews
- **Moderator**: Limited management capabilities

## API Rate Limiting

Consider implementing rate limiting in production:
```bash
npm install express-rate-limit
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network connectivity

### Authentication Errors
- Verify JWT_SECRET is set
- Check token expiration
- Ensure token is in Authorization header

### Build Errors
```bash
# Clean and rebuild
rm -rf dist
npm run build
```

For more help, see the [Backend Developer Guide](docs/BACKEND_DEVELOPER_GUIDE.md).

## Support

- API Explorer: http://localhost:3000/explorer
- Documentation: [docs/](docs/)
- Issues: Create an issue in the repository

## License

Proprietary