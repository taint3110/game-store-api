import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
  name: 'mongodb',
  connector: 'mongodb',
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017/game-store-dev',
};

@lifeCycleObserver('datasource')
export class MongodbDataSource extends juggler.DataSource implements LifeCycleObserver {
  static dataSourceName = 'mongodb';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.mongodb', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
