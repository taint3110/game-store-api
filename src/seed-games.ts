import {GameStoreApplication} from './application';
import {GameRepository, PublisherAccountRepository} from './repositories';
import * as fs from 'fs';
import * as path from 'path';

interface SteamGameData {
  name: string;
  release_date: string;
  required_age: number;
  price: number;
  detailed_description: string;
  about_the_game: string;
  short_description: string;
  supported_languages: string[];
  full_audio_languages: string[];
  categories: string[];
  genres: string[];
  positive: number;
  negative: number;
  estimated_owners: string;
  average_playtime_forever: number;
  average_playtime_2weeks: number;
  median_playtime_forever: number;
  median_playtime_2weeks: number;
  discount: string;
  peak_ccu: number;
  tags: Record<string, number>;
}

type GamesJson = Record<string, SteamGameData>;

async function seedGames() {
  const app = new GameStoreApplication();
  await app.boot();

  const gameRepo = await app.getRepository(GameRepository);
  const publisherRepo = await app.getRepository(PublisherAccountRepository);

  // Read games.json
  const gamesFilePath = path.join(__dirname, '..', 'games.json');
  const gamesData: GamesJson = JSON.parse(fs.readFileSync(gamesFilePath, 'utf-8'));

  // Create or get a default publisher for imported games
  let defaultPublisher = await publisherRepo.findOne({
    where: {email: 'steam-import@gamestore.com'},
  });

  if (!defaultPublisher) {
    defaultPublisher = await publisherRepo.create({
      publisherName: 'Steam Import',
      email: 'steam-import@gamestore.com',
      phoneNumber: '000-000-0000',
      contractDate: new Date(),
      contractDuration: 12,
      activityStatus: 'Active',
      password: 'placeholder-password-hash',
    });
    console.log('Created default publisher for imported games');
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const [steamAppId, gameData] of Object.entries(gamesData)) {
    try {
      // Check if game already exists by name
      const existingGame = await gameRepo.findOne({
        where: {name: gameData.name},
      });

      if (existingGame) {
        skipped++;
        continue;
      }

      // Parse release date
      let releaseDate: Date;
      try {
        releaseDate = parseReleaseDate(gameData.release_date);
      } catch {
        releaseDate = new Date();
      }

      // Determine release status
      const releaseStatus = releaseDate > new Date() ? 'Upcoming' : 'Released';

      // Get primary genre (first one, or 'Other' if none)
      const genre = gameData.genres?.[0] || 'Other';

      // Build Steam image URL using the app ID
      // Steam provides header images at this URL pattern
      const imageUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`;

      await gameRepo.create({
        name: gameData.name,
        genre: genre,
        description: gameData.short_description || gameData.about_the_game || '',
        imageUrl: imageUrl,
        releaseDate: releaseDate,
        publisherId: defaultPublisher.id!,
        releaseStatus: releaseStatus,
        version: '1.0.0',
        originalPrice: gameData.price || 0,
        discountPrice: gameData.discount !== '0' ? calculateDiscountPrice(gameData.price, gameData.discount) : undefined,
      });

      imported++;

      if (imported % 100 === 0) {
        console.log(`Imported ${imported} games...`);
      }
    } catch (err) {
      errors++;
      console.error(`Error importing game ${gameData.name}:`, err);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);

  await app.stop();
  process.exit(0);
}

function parseReleaseDate(dateStr: string): Date {
  // Handle formats like "Apr 28, 2023"
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  throw new Error(`Unable to parse date: ${dateStr}`);
}

function calculateDiscountPrice(originalPrice: number, discountStr: string): number {
  const discountPercent = parseInt(discountStr, 10);
  if (isNaN(discountPercent) || discountPercent === 0) {
    return originalPrice;
  }
  return Math.round(originalPrice * (1 - discountPercent / 100) * 100) / 100;
}

seedGames().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
