import {
  inject,
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {SecurityBindings, UserProfile} from '@loopback/security';
import {HttpErrors} from '@loopback/rest';

@injectable({tags: {key: 'interceptors.authorize'}})
export class AuthorizeInterceptor implements Provider<Interceptor> {
  constructor(
    @inject(SecurityBindings.USER, {optional: true})
    private currentUser?: UserProfile,
  ) {}

  value() {
    return this.intercept.bind(this);
  }

  async intercept(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<InvocationResult>,
  ) {
    // If user is admin, allow all operations
    if (this.currentUser?.accountType === 'admin') {
      return next();
    }

    // Otherwise, proceed with normal authorization
    return next();
  }
}
