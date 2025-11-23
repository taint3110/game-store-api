import {inject} from '@loopback/core';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {promisify} from 'util';
import {TokenService} from '@loopback/authentication';
import {TokenServiceBindings} from '@loopback/authentication-jwt';

const jwt = require('jsonwebtoken');
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
