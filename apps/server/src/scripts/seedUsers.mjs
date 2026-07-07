import mongoose from 'mongoose'
import * as crypto from 'node:crypto'

const MONGO_URL = process.env.MONGO_URL || 'mongodb://scrumlens:scrumlens@localhost:27017/scrumlens'

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1, 128, 'sha1').toString('hex')
}

function generateSalt() {
  return crypto.randomBytes(128).toString('base64')
}

async function seedUsers() {
  try {
    await mongoose.connect(MONGO_URL)
    console.log('Connected to MongoDB via Mongoose')

    // Define schema with password hashing pre-save hook
    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      password: String,
      salt: String,
      isActive: Boolean,
      isGuest: Boolean,
      teamId: String,
      role: String,
    }, { timestamps: true })

    userSchema.pre('save', function (next) {
      if (!this.isModified('password')) return next()
      this.salt = generateSalt()
      this.password = hashPassword(this.password, this.salt)
      next()
    })

    const User = mongoose.model('User', userSchema)

    // Try to find admin - use findOne instead of countDocuments (avoids aggregate auth issue)
    try {
      const existingAdmin = await User.findOne({ teamId: 'admin' }).lean()
      if (existingAdmin) {
        console.log('Users already exist in database.')
        console.log('To re-seed, connect to FerretDB/PostgreSQL and clear the users collection first.')
        await mongoose.disconnect()
        return
      }
    } catch (err) {
      // If findOne also fails with auth error, proceed anyway
      console.log('Note: Auth check failed, proceeding with insert...')
    }

    // Create admin user
    const adminPassword = generateRandomPassword()
    const adminUser = new User({
      name: 'Administrator',
      email: 'admin@scrumlens.local',
      password: adminPassword,
      teamId: 'admin',
      role: 'admin',
      isActive: true,
      isGuest: false,
    })
    await adminUser.save()
    console.log('Admin user created')

    // Create team users
    const passwords = {}
    for (let i = 1; i <= 24; i++) {
      const teamId = `team${i}`
      const pw = generateRandomPassword()
      passwords[teamId] = pw
      const teamUser = new User({
        name: `Team ${i}`,
        email: `${teamId}@scrumlens.local`,
        password: pw,
        teamId: teamId,
        role: 'editor',
        isActive: true,
        isGuest: false,
      })
      await teamUser.save()
    }

    console.log('\n' + '='.repeat(60))
    console.log('PASSWORD REPORT - STORE SECURELY')
    console.log('='.repeat(60))
    console.log(`\nAdmin Access:`)
    console.log(`  Username: admin`)
    console.log(`  Password: ${adminPassword}`)
    console.log('\nTeam Access:')
    for (let i = 1; i <= 24; i++) {
      const teamId = `team${i}`
      console.log(`  ${teamId}: ${passwords[teamId]}`)
    }
    console.log('\n' + '='.repeat(60))
    console.log('Setup complete!')

    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 16; i++) {
    const randomByte = crypto.randomBytes(1)[0]
    password += chars[randomByte % chars.length]
  }
  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

seedUsers()