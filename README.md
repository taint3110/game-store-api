# Game Store API

A REST API built with LoopBack 4 for managing a game store platform with customer accounts, game listings, orders, and reviews.

## Features

- Customer, Publisher, and Admin account management
- Game catalog with search and filtering
- Order processing with game key assignment
- Review and rating system
- Promotional offers
- JWT authentication
- MongoDB database

## Prerequisites

- Node.js 18 or 20
- MongoDB 5.0+
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB connection string and JWT secret.

## Running the Application

```bash
# Development
npm start

# Build
npm run build

# Run tests
npm test
```

The API will be available at `http://localhost:3000`

API Explorer: `http://localhost:3000/explorer`

## Project Structure

```
src/
├── controllers/     # API endpoints
├── models/          # Data models
├── repositories/    # Data access layer
├── services/        # Business logic
├── datasources/     # Database connections
├── application.ts   # Application setup
├── sequence.ts      # Request handling sequence
└── index.ts         # Entry point
```

## Docker

Build and run with Docker:

```bash
npm run docker:build
npm run docker:run
```

## License

Proprietary