export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  accountType: 'customer' | 'publisher' | 'admin';
}

export interface Credentials {
  email: string;
  password: string;
}

export interface TokenResponse {
  token: string;
  user: UserProfile;
}
