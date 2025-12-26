import * as dotenv from 'dotenv';
import {GameStoreApplication} from './application';
import {
  AdminAccountRepository,
  CustomerAccountRepository,
  GenderRepository,
  PublisherAccountRepository,
} from './repositories';
import {PasswordService} from './services';

dotenv.config();

async function main() {
  const app = new GameStoreApplication({
    rest: {
      port: 0, // use ephemeral port to avoid collisions while seeding
      host: process.env.HOST ?? '127.0.0.1',
    },
  });
  await app.boot();
  await app.start();

  const genderRepo = await app.getRepository(GenderRepository);
  const adminRepo = await app.getRepository(AdminAccountRepository);
  const customerRepo = await app.getRepository(CustomerAccountRepository);
  const publisherRepo = await app.getRepository(PublisherAccountRepository);
  const passwordService = await app.get<PasswordService>('services.PasswordService');

  const now = new Date();

  // Ensure a default gender exists so optional references have a value
  let defaultGender = await genderRepo.findOne({where: {name: 'Unspecified'}});
  if (!defaultGender) {
    defaultGender = await genderRepo.create({name: 'Unspecified'});
    console.log('Seeded gender: Unspecified');
  }

  // Seed a SuperAdmin account
  const adminEmail = 'admin@gamestore.com';
  let admin = await adminRepo.findOne({where: {email: adminEmail}});
  if (!admin) {
    const password = await passwordService.hashPassword('Admin@123456');
    admin = await adminRepo.create({
      email: adminEmail,
      phoneNumber: '0123456789',
      role: 'SuperAdmin',
      password,
      genderId: defaultGender?.id,
      createdAt: now,
      updatedAt: now,
    });
    console.log('Seeded admin:', adminEmail);
  } else {
    console.log('Admin already exists:', adminEmail);
  }

  // Seed a sample customer
  const customerEmail = 'customer@gamestore.com';
  let customer = await customerRepo.findOne({where: {email: customerEmail}});
  if (!customer) {
    const password = await passwordService.hashPassword('Customer@123456');
    customer = await customerRepo.create({
      email: customerEmail,
      phoneNumber: '0123456790',
      username: 'customer1',
      password,
      genderId: defaultGender?.id,
      registrationDate: now,
      accountStatus: 'Active',
      accountBalance: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log('Seeded customer:', customerEmail);
  } else {
    console.log('Customer already exists:', customerEmail);
  }

  // Seed a sample publisher
  const publisherEmail = 'publisher@gamestore.com';
  let publisher = await publisherRepo.findOne({where: {email: publisherEmail}});
  if (!publisher) {
    const password = await passwordService.hashPassword('Publisher@123456');
    publisher = await publisherRepo.create({
      publisherName: 'Demo Publisher',
      email: publisherEmail,
      phoneNumber: '0123456791',
      password,
      contractDate: now,
      contractDuration: 12,
      activityStatus: 'Active',
      createdAt: now,
      updatedAt: now,
    });
    console.log('Seeded publisher:', publisherEmail);
  } else {
    console.log('Publisher already exists:', publisherEmail);
  }

  await app.stop();
  process.exit(0);
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
