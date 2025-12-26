import {ApplicationConfig, GameStoreApplication} from './application';
import * as dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();
// Use public DNS to ensure SRV records (Mongo Atlas) resolve even if local DNS fails
dns.setServers(['8.8.8.8', '1.1.1.1']);

export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new GameStoreApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  console.log(`Try ${url}/ping`);
  console.log(`API Explorer is available at ${url}/explorer`);

  return app;
}

if (require.main === module) {
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
      gracePeriodForClose: 5000,
      cors: {
        origin: corsOrigins.length > 0 ? corsOrigins : true,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      },
      openApiSpec: {
        setServersFromRequest: true,
      },
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
