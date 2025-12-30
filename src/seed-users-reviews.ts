import {GameStoreApplication} from './application';
import {
  CustomerAccountRepository,
  GameRepository,
  ReviewRepository,
  GenderRepository,
} from './repositories';
import * as bcrypt from 'bcryptjs';

// Sample data for generating realistic reviews
const positiveReviews = [
  'Amazing game! Highly recommend it to everyone.',
  'One of the best games I have ever played. Worth every penny!',
  'Great gameplay and stunning graphics. Love it!',
  'Addictive and fun. Spent hours playing this.',
  'Excellent story and characters. A must-play!',
  'Smooth controls and engaging mechanics.',
  'This game exceeded my expectations. Fantastic!',
  'Perfect for both casual and hardcore gamers.',
  'The developers did an outstanding job here.',
  'Incredible experience from start to finish.',
];

const neutralReviews = [
  'Decent game, nothing special but enjoyable.',
  'Good game but could use some improvements.',
  'Average gameplay, but the story is interesting.',
  'Not bad, but I expected more from this title.',
  'Solid game with a few minor issues.',
  'Fun at times, but gets repetitive.',
  'Worth playing if you like this genre.',
  'Has potential but needs more content.',
];

const negativeReviews = [
  'Not my cup of tea. Too slow-paced.',
  'Had some bugs that ruined the experience.',
  'Overpriced for what it offers.',
  'The controls feel clunky and unresponsive.',
  'Disappointing compared to similar games.',
];

const firstNames = [
  'Minh', 'Hoa', 'Tuan', 'Linh', 'Nam', 'Mai', 'Duc', 'Lan', 'Hung', 'Thao',
  'Phong', 'Nga', 'Khanh', 'Huong', 'Long', 'Yen', 'Hai', 'Trang', 'Quang', 'Nhung',
  'Binh', 'Phuong', 'Thanh', 'Hien', 'Trung', 'Anh', 'Dung', 'Ngoc', 'Cuong', 'Thu',
  'Vinh', 'Loan', 'Hoang', 'Tam', 'Son', 'Ly', 'Tien', 'Van', 'Dat', 'Chi',
];

const lastNames = [
  'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Vo', 'Dang', 'Bui', 'Do',
  'Ho', 'Ngo', 'Duong', 'Ly', 'Truong', 'Dinh', 'Huynh', 'Cao', 'Luu', 'Trinh',
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhoneNumber(index: number): string {
  const prefix = '09';
  const suffix = String(10000000 + index).padStart(8, '0');
  return prefix + suffix;
}

function getReviewByRating(rating: number): string {
  if (rating >= 4) return getRandomElement(positiveReviews);
  if (rating >= 3) return getRandomElement(neutralReviews);
  return getRandomElement(negativeReviews);
}

async function seedUsersAndReviews() {
  const app = new GameStoreApplication();
  await app.boot();

  const customerRepo = await app.getRepository(CustomerAccountRepository);
  const gameRepo = await app.getRepository(GameRepository);
  const reviewRepo = await app.getRepository(ReviewRepository);
  const genderRepo = await app.getRepository(GenderRepository);

  // Get or create genders
  let genders = await genderRepo.find();
  if (genders.length === 0) {
    await genderRepo.createAll([
      {name: 'Male'},
      {name: 'Female'},
      {name: 'Other'},
    ]);
    genders = await genderRepo.find();
  }

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create 100 users
  console.log('Creating 100 users...');
  const users: any[] = [];

  for (let i = 1; i <= 100; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${i}`;

    try {
      const existingUser = await customerRepo.findOne({
        where: {email: `${username}@example.com`},
      });

      if (existingUser) {
        users.push(existingUser);
        continue;
      }

      const user = await customerRepo.create({
        email: `${username}@example.com`,
        phoneNumber: generatePhoneNumber(i),
        username: `${firstName} ${lastName}`,
        password: hashedPassword,
        genderId: getRandomElement(genders).id,
        accountStatus: 'Active',
        accountBalance: Math.floor(Math.random() * 500),
      });

      users.push(user);

      if (i % 20 === 0) {
        console.log(`Created ${i} users...`);
      }
    } catch (err) {
      console.error(`Error creating user ${i}:`, err.message);
    }
  }

  console.log(`Total users available: ${users.length}`);

  // Get all games
  const games = await gameRepo.find({where: {releaseStatus: 'Released'}});
  console.log(`Found ${games.length} games to review`);

  if (games.length === 0) {
    console.log('No games found. Run seed-games first.');
    await app.stop();
    process.exit(0);
  }

  // Create reviews
  console.log('Creating reviews...');
  let reviewsCreated = 0;
  let reviewsSkipped = 0;

  for (const game of games) {
    // Select 5 random users for this game
    const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
    const reviewers = shuffledUsers.slice(0, 5);

    for (const user of reviewers) {
      try {
        // Check if review already exists
        const existingReview = await reviewRepo.findOne({
          where: {customerId: user.id, gameId: game.id},
        });

        if (existingReview) {
          reviewsSkipped++;
          continue;
        }

        // Generate rating (weighted towards positive)
        const rand = Math.random();
        let rating: number;
        if (rand < 0.5) rating = 5;
        else if (rand < 0.75) rating = 4;
        else if (rand < 0.9) rating = 3;
        else if (rand < 0.97) rating = 2;
        else rating = 1;

        await reviewRepo.create({
          customerId: user.id,
          gameId: game.id,
          reviewText: getReviewByRating(rating),
          rating,
          createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date within last 90 days
        });

        reviewsCreated++;
      } catch (err) {
        console.error(`Error creating review for game ${game.name}:`, err.message);
      }
    }

    if (reviewsCreated % 500 === 0 && reviewsCreated > 0) {
      console.log(`Created ${reviewsCreated} reviews...`);
    }
  }

  console.log('\n=== Seed Complete ===');
  console.log(`Users created/found: ${users.length}`);
  console.log(`Reviews created: ${reviewsCreated}`);
  console.log(`Reviews skipped (already exist): ${reviewsSkipped}`);

  await app.stop();
  process.exit(0);
}

seedUsersAndReviews().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
