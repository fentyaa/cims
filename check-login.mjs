import prisma from './config/database.js';
import bcrypt from 'bcrypt';

async function check() {
  const user = await prisma.user.findUnique({ where: { email: 'mentor.cims@gmail.com' } });
  if (!user) {
    console.log('❌ USER mentor.cims@gmail.com NOT FOUND in database');
    await prisma.$disconnect();
    return;
  }
  console.log('✅ User found:', user.email, '- Role:', user.role, '- Status:', user.status);
  console.log('   Password hash starts with:', user.password.substring(0, 25) + '...');
  
  // Test bcrypt compare
  const match = await bcrypt.compare('Mentor123!', user.password);
  console.log('✅ Password "Mentor123!" matches:', match);
  
  // Also test common issues - maybe the password has trailing spaces
  const matchTrim = await bcrypt.compare('Mentor123!'.trim(), user.password);
  console.log('   Trimmed match:', matchTrim);
  
  await prisma.$disconnect();
}
check().catch(e => console.error(e));

