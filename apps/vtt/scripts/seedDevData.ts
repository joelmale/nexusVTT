import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database service and generators (using relative ES Module specifier)
import { createDatabaseService } from '../server/database.js';
import { generateRandomCampaign, generateRandomCharacter } from '../server/utils/mockGenerator.js';

async function seed() {
  console.log('🎲 Initializing Database Seeding...');
  
  const db = createDatabaseService();
  await db.initialize();
  
  const email = 'dev@nexusvtt.com';
  const password = 'password123';
  const displayName = 'Dev Dungeon Master';
  
  try {
    let user = await db.getUserByEmail(email);
    if (!user) {
      console.log(`👤 Creating test user: ${email}...`);
      user = await db.createLocalUser(email, password, displayName);
      console.log(`👤 User created with ID: ${user.id}`);
    } else {
      console.log(`👤 User ${email} already exists with ID: ${user.id}`);
    }
    
    // Clear existing campaigns and characters for this user to avoid duplicate bloat
    console.log('🧹 Cleaning up old campaigns and characters for this user...');
    await db.getPool().query('DELETE FROM campaigns WHERE "dmId" = $1', [user.id]);
    await db.getPool().query('DELETE FROM characters WHERE "ownerId" = $1', [user.id]);
    
    // Generate 3 campaigns
    console.log('⚔️ Seeding 3 random campaigns...');
    for (let i = 0; i < 3; i++) {
      const campData = generateRandomCampaign(user.id);
      const campaign = await db.createCampaign(user.id, campData.name, campData.description);
      console.log(`   + Created Campaign: "${campaign.name}" (ID: ${campaign.id})`);
    }
    
    // Generate 4 characters
    console.log('🛡️ Seeding 4 random characters...');
    for (let i = 0; i < 4; i++) {
      const charData = generateRandomCharacter(user.id);
      const character = await db.createCharacter(user.id, charData.name, charData.data);
      console.log(`   + Created Character: "${character.name}" (${character.data.race} ${character.data.class}, Level ${character.data.level})`);
    }
    
    console.log('✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await db.close();
  }
}

seed();
