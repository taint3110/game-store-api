# Game Store API Documentation

## Table of Contents
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Getting Started

### Base URL
```
Development: http://localhost:3000
```

### API Explorer
Access the interactive API documentation at:
```
http://localhost:3000/explorer
```

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication

### Register Customer
**POST** `/auth/customer/register`

Create a new customer account.

**Request Body:**
```json
{
  "email": "customer@example.com",
  "phoneNumber": "0123456789",
  "username": "johndoe",
  "password": "password123",
  "genderId": "optional-gender-id"
}
```

**Response:** `201 Created`
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "customer@example.com",
  "username": "johndoe",
  "phoneNumber": "0123456789",
  "accountStatus": "Active",
  "accountBalance": 0,
  "registrationDate": "2024-01-01T00:00:00.000Z"
}
```

### Login Customer
**POST** `/auth/customer/login`

**Request Body:**
```json
{
  "email": "customer@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "customer@example.com",
    "username": "johndoe",
    "accountType": "customer"
  }
}
```

### Register Publisher
**POST** `/auth/publisher/register`

**Request Body:**
```json
{
  "publisherName": "Game Studio Inc",
  "email": "publisher@example.com",
  "phoneNumber": "0123456789",
  "password": "password123",
  "contractDate": "2024-01-01",
  "contractDuration": 12,
  "socialMedia": "https://twitter.com/gamestudio",
  "bankType": "Commercial",
  "bankName": "Bank of America"
}
```

### Login Publisher
**POST** `/auth/publisher/login`

**Request Body:**
```json
{
  "email": "publisher@example.com",
  "password": "password123"
}
```

### Login Admin
**POST** `/auth/admin/login`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "admin@example.com",
    "accountType": "admin",
    "role": "SuperAdmin"
  }
}
```

---

## API Endpoints

### Games

#### List Games
**GET** `/games`

Public endpoint to list all released games.

**Query Parameters:**
- `search` (string): Search by game name
- `genre` (string): Filter by genre
- `publisherId` (string): Filter by publisher

**Response:** `200 OK`
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "Epic Adventure",
    "genre": "RPG",
    "description": "An epic adventure game",
    "imageUrl": "https://example.com/image.jpg",
    "releaseDate": "2024-01-01",
    "version": "1.0.0",
    "originalPrice": 59.99,
    "discountPrice": 49.99,
    "releaseStatus": "Released",
    "publisherId": "507f1f77bcf86cd799439012",
    "publisher": {
      "id": "507f1f77bcf86cd799439012",
      "publisherName": "Game Studio Inc"
    }
  }
]
```

#### Get Game Details
**GET** `/games/{id}`

**Response:** `200 OK`
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "Epic Adventure",
  "genre": "RPG",
  "description": "An epic adventure game",
  "averageRating": 4.5,
  "publisher": {
    "publisherName": "Game Studio Inc"
  }
}
```

#### Create Game
**POST** `/games`

🔒 **Requires Authentication:** Publisher or Admin

**Request Body:**
```json
{
  "name": "New Game",
  "genre": "Action",
  "description": "A new action game",
  "imageUrl": "https://example.com/image.jpg",
  "videoUrl": "https://example.com/video.mp4",
  "releaseDate": "2024-12-01",
  "version": "1.0.0",
  "originalPrice": 59.99,
  "discountPrice": 49.99,
  "publisherId": "optional-for-admin-only"
}
```

**Response:** `201 Created`

#### Update Game
**PATCH** `/games/{id}`

🔒 **Requires Authentication:** Publisher (own games) or Admin (any game)

**Request Body:**
```json
{
  "name": "Updated Game Name",
  "discountPrice": 39.99
}
```

**Response:** `200 OK`

#### Delete Game
**DELETE** `/games/{id}`

🔒 **Requires Authentication:** Publisher (own games) or Admin (any game)

Soft deletes the game by setting status to "Delisted".

**Response:** `204 No Content`

#### Get Game Reviews
**GET** `/games/{id}/reviews`

**Query Parameters:**
- `sort` (string): `date_desc`, `date_asc`, `rating_desc`, `rating_asc`

**Response:** `200 OK`
```json
{
  "reviews": [
    {
      "id": "507f1f77bcf86cd799439011",
      "rating": 5,
      "comment": "Great game!",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "customer": {
        "username": "johndoe"
      }
    }
  ],
  "averageRating": 4.5,
  "totalReviews": 10
}
```

---

### Customer Account

#### Get My Profile
**GET** `/customers/me`

🔒 **Requires Authentication:** Customer

**Response:** `200 OK`
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "customer@example.com",
  "username": "johndoe",
  "phoneNumber": "0123456789",
  "accountStatus": "Active",
  "accountBalance": 100.00,
  "gender": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Male"
  }
}
```

#### Update My Profile
**PATCH** `/customers/me`

🔒 **Requires Authentication:** Customer

**Request Body:**
```json
{
  "username": "newusername",
  "phoneNumber": "0987654321",
  "genderId": "507f1f77bcf86cd799439012"
}
```

**Response:** `200 OK`

#### Change Password
**POST** `/customers/me/change-password`

🔒 **Requires Authentication:** Customer

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response:** `204 No Content`

#### Get My Orders
**GET** `/customers/me/orders`

🔒 **Requires Authentication:** Customer

**Response:** `200 OK`
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "orderDate": "2024-01-01T00:00:00.000Z",
    "totalAmount": 49.99,
    "orderDetails": [
      {
        "id": "507f1f77bcf86cd799439012",
        "quantity": 1,
        "unitPrice": 49.99,
        "game": {
          "name": "Epic Adventure"
        },
        "gameKey": {
          "keyCode": "XXXX-XXXX-XXXX-XXXX"
        }
      }
    ]
  }
]
```

---

### Admin Account

#### Get My Profile
**GET** `/admins/me`

🔒 **Requires Authentication:** Admin

**Response:** `200 OK`
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "admin@example.com",
  "role": "SuperAdmin",
  "phoneNumber": "0123456789",
  "_tokenInfo": {
    "accountType": "admin",
    "role": "SuperAdmin"
  }
}
```

#### Update My Profile
**PATCH** `/admins/me`

🔒 **Requires Authentication:** Admin

**Request Body:**
```json
{
  "phoneNumber": "0987654321",
  "genderId": "507f1f77bcf86cd799439012"
}
```

#### Change Password
**POST** `/admins/me/change-password`

🔒 **Requires Authentication:** Admin

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

#### Create Admin
**POST** `/admins`

🔒 **Requires Authentication:** SuperAdmin only

**Request Body:**
```json
{
  "email": "newadmin@example.com",
  "phoneNumber": "0123456789",
  "role": "Admin",
  "password": "password123",
  "genderId": "optional-gender-id"
}
```

**Roles:**
- `SuperAdmin`: Full access, can create/delete admins
- `Admin`: Can manage users and content
- `Moderator`: Limited management access

#### List Admins
**GET** `/admins`

🔒 **Requires Authentication:** SuperAdmin or Admin

#### Get Admin by ID
**GET** `/admins/{id}`

🔒 **Requires Authentication:** SuperAdmin or Admin

#### Update Admin
**PATCH** `/admins/{id}`

🔒 **Requires Authentication:** SuperAdmin only

#### Delete Admin
**DELETE** `/admins/{id}`

🔒 **Requires Authentication:** SuperAdmin only

---

### Admin Management

All endpoints in this section require Admin authentication.

#### Customer Management

**GET** `/admin/customers`
List all customers

**GET** `/admin/customers/{id}`
Get customer details

**PATCH** `/admin/customers/{id}`
Update customer (can modify status, balance, etc.)

**Request Body:**
```json
{
  "accountStatus": "Suspended",
  "accountBalance": 50.00
}
```

**DELETE** `/admin/customers/{id}`
Delete customer account

#### Publisher Management

**GET** `/admin/publishers`
List all publishers

**GET** `/admin/publishers/{id}`
Get publisher details

**PATCH** `/admin/publishers/{id}`
Update publisher

**DELETE** `/admin/publishers/{id}`
Delete publisher account

#### Order Management

**GET** `/admin/orders`
List all orders with full details

**GET** `/admin/orders/{id}`
Get specific order details

#### Game Management

**GET** `/admin/games`
List all games (including delisted)

#### Review Management

**GET** `/admin/reviews`
List all reviews

**DELETE** `/admin/reviews/{id}`
Delete a review

#### Statistics

**GET** `/admin/statistics`

Get platform statistics.

**Response:** `200 OK`
```json
{
  "totalCustomers": 1500,
  "totalPublishers": 50,
  "totalGames": 200,
  "totalOrders": 5000,
  "totalReviews": 3000
}
```

---

## Error Handling

### Error Response Format
```json
{
  "error": {
    "statusCode": 400,
    "name": "BadRequestError",
    "message": "Detailed error message"
  }
}
```

### Common Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `204 No Content`: Request succeeded with no response body
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists (e.g., duplicate email)
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

### Common Errors

#### Invalid Credentials
```json
{
  "error": {
    "statusCode": 401,
    "name": "UnauthorizedError",
    "message": "Invalid credentials"
  }
}
```

#### Duplicate Email
```json
{
  "error": {
    "statusCode": 409,
    "name": "ConflictError",
    "message": "Email already exists"
  }
}
```

#### Insufficient Permissions
```json
{
  "error": {
    "statusCode": 403,
    "name": "ForbiddenError",
    "message": "Only publishers can create games"
  }
}
```

---

## Examples

### Frontend Integration (JavaScript/TypeScript)

#### Setup API Client
```javascript
const API_BASE_URL = 'http://localhost:3000';

class GameStoreAPI {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // Auth methods
  async loginCustomer(email, password) {
    const data = await this.request('/auth/customer/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async registerCustomer(userData) {
    return this.request('/auth/customer/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async loginAdmin(email, password) {
    const data = await this.request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  // Game methods
  async getGames(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/games?${params}`);
  }

  async getGameById(id) {
    return this.request(`/games/${id}`);
  }

  async createGame(gameData) {
    return this.request('/games', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  async updateGame(id, gameData) {
    return this.request(`/games/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(gameData),
    });
  }

  async deleteGame(id) {
    return this.request(`/games/${id}`, {
      method: 'DELETE',
    });
  }

  // Customer methods
  async getMyProfile() {
    return this.request('/customers/me');
  }

  async updateMyProfile(data) {
    return this.request('/customers/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/customers/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getMyOrders() {
    return this.request('/customers/me/orders');
  }

  // Admin methods
  async getAdminStatistics() {
    return this.request('/admin/statistics');
  }

  async getAllCustomers() {
    return this.request('/admin/customers');
  }

  async updateCustomer(id, data) {
    return this.request(`/admin/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

// Usage
const api = new GameStoreAPI();

// Login
try {
  const result = await api.loginCustomer('user@example.com', 'password123');
  console.log('Logged in:', result.user);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Get games
const games = await api.getGames({ genre: 'RPG' });
console.log('RPG Games:', games);

// Create game (as publisher/admin)
const newGame = await api.createGame({
  name: 'New Game',
  genre: 'Action',
  description: 'An exciting new game',
  releaseDate: '2024-12-01',
  version: '1.0.0',
  originalPrice: 59.99,
});
```

#### React Example
```jsx
import { useState, useEffect } from 'react';

function GameList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchGames() {
      try {
        const api = new GameStoreAPI();
        const data = await api.getGames();
        setGames(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Games</h1>
      {games.map(game => (
        <div key={game.id}>
          <h2>{game.name}</h2>
          <p>{game.description}</p>
          <p>Price: ${game.discountPrice || game.originalPrice}</p>
        </div>
      ))}
    </div>
  );
}
```

#### Vue Example
```vue
<template>
  <div>
    <h1>Games</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <div v-for="game in games" :key="game.id">
        <h2>{{ game.name }}</h2>
        <p>{{ game.description }}</p>
        <p>Price: ${{ game.discountPrice || game.originalPrice }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  setup() {
    const games = ref([]);
    const loading = ref(true);
    const error = ref(null);

    onMounted(async () => {
      try {
        const api = new GameStoreAPI();
        games.value = await api.getGames();
      } catch (err) {
        error.value = err.message;
      } finally {
        loading.value = false;
      }
    });

    return { games, loading, error };
  }
};
</script>
```

---

## Rate Limiting & Best Practices

### Best Practices

1. **Store tokens securely**: Use httpOnly cookies or secure storage
2. **Handle token expiration**: Implement token refresh logic
3. **Validate input**: Always validate user input on the frontend
4. **Handle errors gracefully**: Show user-friendly error messages
5. **Use loading states**: Provide feedback during API calls
6. **Cache when appropriate**: Cache game lists and static data
7. **Implement retry logic**: For failed requests
8. **Use environment variables**: For API URLs and configuration

### Security Considerations

1. Never store passwords in plain text
2. Always use HTTPS in production
3. Implement CORS properly
4. Validate JWT tokens on every request
5. Use strong passwords (minimum 8 characters)
6. Implement rate limiting on sensitive endpoints
7. Log security events

---

## Support

For issues or questions:
- Check the API Explorer: http://localhost:3000/explorer
- Review error messages carefully
- Ensure authentication tokens are valid
- Verify request body matches the schema
