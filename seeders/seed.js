require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Election, Candidate } = require('../models');

const seedDatabase = async () => {
  try {
    console.log('🔄 Syncing Sequelize database schema...');
    await sequelize.sync();
    console.log('✅ Database schema synchronized.');

    // 1. Ensure Superadmin account exists
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount === 0) {
      const adminSalt = await bcrypt.genSalt(12);
      const adminHash = await bcrypt.hash('Admin@123', adminSalt);
      await User.create({
        username: 'admin',
        name: 'Election Commissioner',
        email: 'admin@college.edu',
        password_hash: adminHash,
        role: 'admin',
        department: 'Election Authority'
      });
      console.log('✅ Default administrator seeded (username: admin / password: Admin@123)');
    }

    // 2. Ensure active election exists
    const electionCount = await Election.count();
    if (electionCount === 0) {
      await Election.create({
        title: 'Campus Student Council Election',
        status: 'open'
      });
      console.log('✅ Active election created (status: open)');
    }

    // 3. Ensure candidate roster exists
    const candidateCount = await Candidate.count();
    if (candidateCount === 0) {
      await Candidate.bulkCreate([
        { post_key: 'president', post_title: 'President', name: 'Aarav Sharma', department: 'Computer Science', slogan: 'Better labs, better Wi-Fi' },
        { post_key: 'president', post_title: 'President', name: 'Meera Iyer', department: 'Electronics', slogan: 'A voice for every student' },
        { post_key: 'vpBoy', post_title: 'Vice President (Boy)', name: 'Kunal Deshmukh', department: 'Civil', slogan: 'Sports and fitness for all' },
        { post_key: 'vpBoy', post_title: 'Vice President (Boy)', name: 'Siddharth Rao', department: 'Computer Science', slogan: 'More hackathons' },
        { post_key: 'vpGirl', post_title: 'Vice President (Girl)', name: 'Ananya Kulkarni', department: 'IT', slogan: 'Safe and inclusive campus' },
        { post_key: 'vpGirl', post_title: 'Vice President (Girl)', name: 'Priya Nair', department: 'Electronics', slogan: 'Stronger clubs and events' }
      ]);
      console.log('✅ Initial candidates seeded.');
    }

    // 4. Ensure demo students exist
    const studentCount = await User.count({ where: { role: 'student' } });
    if (studentCount === 0) {
      const studentSalt = await bcrypt.genSalt(12);
      const studentHash = await bcrypt.hash('Student@123', studentSalt);

      await User.bulkCreate([
        {
          roll_number: '21CS001',
          name: 'Riya Joshi',
          email: 'riya@college.edu',
          phone: '9876543210',
          password_hash: studentHash,
          role: 'student',
          department: 'Computer Science',
          student_class: 'TY-CS',
          gender: 'F',
          approval_status: 'approved',
          has_voted: false
        },
        {
          roll_number: '21CS002',
          name: 'Arjun Mehta',
          email: 'arjun@college.edu',
          phone: '9876543211',
          password_hash: studentHash,
          role: 'student',
          department: 'Mechanical',
          student_class: 'TY-ME',
          gender: 'M',
          approval_status: 'approved',
          has_voted: false
        },
        {
          roll_number: '21EC014',
          name: 'Neha Kapoor',
          email: 'neha@college.edu',
          phone: '9876543212',
          password_hash: studentHash,
          role: 'student',
          department: 'Electronics',
          student_class: 'SY-EC',
          gender: 'F',
          approval_status: 'pending',
          has_voted: false
        }
      ]);
      console.log('✅ Initial demo students seeded.');
    }

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database seeding error:', error);
  }
};

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;
