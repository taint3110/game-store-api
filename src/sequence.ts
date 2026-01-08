import { inject } from '@loopback/core';
import {
    FindRoute,
    InvokeMethod,
    ParseParams,
    Reject,
    RequestContext,
    RestBindings,
    Send,
    SequenceHandler,
} from '@loopback/rest';
import { AuthenticationBindings, AuthenticateFn } from '@loopback/authentication';

export class MySequence implements SequenceHandler {
    constructor(
        @inject(RestBindings.SequenceActions.FIND_ROUTE) protected findRoute: FindRoute,
        @inject(RestBindings.SequenceActions.PARSE_PARAMS) protected parseParams: ParseParams,
        @inject(RestBindings.SequenceActions.INVOKE_METHOD) protected invoke: InvokeMethod,
        @inject(RestBindings.SequenceActions.SEND) public send: Send,
        @inject(RestBindings.SequenceActions.REJECT) public reject: Reject,
        @inject(AuthenticationBindings.AUTH_ACTION) protected authenticateRequest: AuthenticateFn,
    ) {}

    async handle(context: RequestContext) {
        try {
            const { request, response } = context;

            // ✅ Thêm CORS headers CHO TẤT CẢ requests (bao gồm cả OPTIONS)
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
            response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            response.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight 24h

            // ✅ Xử lý preflight OPTIONS request
            if (request.method === 'OPTIONS') {
                response.status(204).end();
                return;
            }

            const route = this.findRoute(request);
            await this.authenticateRequest(request);
            const args = await this.parseParams(request, route);
            const result = await this.invoke(route, args);

            this.send(response, result);
        } catch (err) {
            this.reject(context, err);
        }
    }
}
