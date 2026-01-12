import { BootMixin } from '@loopback/boot';
import { ApplicationConfig } from '@loopback/core';
import { RestExplorerBindings, RestExplorerComponent } from '@loopback/rest-explorer';
import { RepositoryMixin } from '@loopback/repository';
import { RestApplication } from '@loopback/rest';
import { ServiceMixin } from '@loopback/service-proxy';
import path from 'path';
import { MySequence } from './sequence';
import { AuthenticationComponent } from '@loopback/authentication';
import { JWTAuthenticationComponent, TokenServiceBindings } from '@loopback/authentication-jwt';
import { MongodbDataSource } from './datasources';
import { PasswordService, AuthService, JWTService } from './services';

export { ApplicationConfig };

export class GameStoreApplication extends BootMixin(ServiceMixin(RepositoryMixin(RestApplication))) {
    constructor(options: ApplicationConfig = {}) {
        options = {
            ...options,
            rest: {
                ...options.rest,
                port: 3000,
                cors: {
                    origin: '*', // Cho phép tất cả origins (chỉ dùng khi dev)
                    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
                    credentials: false, // Đổi thành false nếu dùng origin: '*'
                    allowedHeaders: ['Content-Type', 'Authorization'],
                },
            },
        };

        super(options);

        this.sequence(MySequence);

        this.static('/', path.join(__dirname, '../public'));

        this.configure(RestExplorerBindings.COMPONENT).to({ path: '/explorer' });
        this.component(RestExplorerComponent);

        this.component(AuthenticationComponent);
        this.component(JWTAuthenticationComponent);

        this.dataSource(MongodbDataSource);

        this.bind(TokenServiceBindings.TOKEN_SECRET).to(process.env.JWT_SECRET ?? 'dev-secret');
        console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET);
        this.bind(TokenServiceBindings.TOKEN_EXPIRES_IN).to('7d');
        this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService);

        this.service(PasswordService);
        this.service(AuthService);

        this.projectRoot = __dirname;

        this.bootOptions = {
            controllers: {
                dirs: ['controllers'],
                extensions: ['.controller.js'],
                nested: true,
            },
        };
    }
}
