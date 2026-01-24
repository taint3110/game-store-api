import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {parse} from 'csv-parse/sync';
import {MongodbDataSource} from './datasources';

dotenv.config();

async function main() {
  const dataSource = new MongodbDataSource();
  await dataSource.connect();

  const connector: any = dataSource.connector;
  const db = connector?.db || connector?.client?.db?.();
  if (!db) {
    throw new Error('MongoDB connection not available');
  }
  const collection = db.collection('steam_apps');
  await collection.createIndex({steamAppId: 1}, {unique: true});

  const csvPath = path.resolve(__dirname, '../paid_games_appid_name.csv');
  const csvContent = await fs.promises.readFile(csvPath, 'utf8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{appid: string; name: string}>;

  const now = new Date();
  const bulkOps = records
    .map(row => {
      const steamAppId = Number(row.appid);
      const name = row.name?.trim();
      if (!steamAppId || !name) return undefined;
      const updateDoc = {
        steamAppId,
        name,
        avatarUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`,
        detailsUrl: `https://store.steampowered.com/api/appdetails?appids=${steamAppId}`,
        updatedAt: now,
      };
      return {
        updateOne: {
          filter: {steamAppId},
          update: {$set: updateDoc, $setOnInsert: {createdAt: now}},
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (bulkOps.length === 0) {
    console.log('No records parsed from CSV.');
    await dataSource.disconnect();
    return;
  }

  const result = await collection.bulkWrite(bulkOps, {ordered: false});
  const upserts = result.upsertedCount ?? 0;
  const updates = result.modifiedCount ?? 0;
  console.log(`Import complete. Upserts: ${upserts}, Updates: ${updates}`);

  await dataSource.disconnect();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
