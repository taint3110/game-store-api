import {injectable} from '@loopback/core';
import * as bcrypt from 'bcryptjs';

@injectable()
export class PasswordService {
  private readonly rounds: number;

  constructor() {
    this.rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  async comparePassword(provided: string, stored: string): Promise<boolean> {
    return bcrypt.compare(provided, stored);
  }
}
