import {UserProfile as LBUserProfile} from '@loopback/security';

export interface UserProfile extends LBUserProfile {
  id: string;
  email: string;
  username?: string;
  accountType: 'customer' | 'publisher' | 'admin';
  role?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface TokenResponse {
  token: string;
  user: UserProfile;
}
