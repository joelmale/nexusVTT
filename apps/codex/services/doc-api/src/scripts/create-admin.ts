import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prompts from 'prompts';

const prisma = new PrismaClient();

async function main() {
  const response = await prompts([
    {
      type: 'text',
      name: 'username',
      message: 'Enter a username for the admin user',
    },
    {
      type: 'text',
      name: 'email',
      message: 'Enter an email for the admin user',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Enter a password for the admin user',
    },
  ]);

  const { username, email, password } = response;

  if (!username || !email || !password) {
    console.error('Username, email, and password are required.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  console.log(`Admin user "${username}" created successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
