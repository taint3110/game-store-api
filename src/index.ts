import {ApplicationConfig, GameStoreApplication} from './application';
import * as dotenv from 'dotenv';

dotenv.config();

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
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
      gracePeriodForClose: 5000,
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
