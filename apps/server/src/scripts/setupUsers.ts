import mongoose from 'mongoose'
import * as crypto from 'node:crypto'
import { User, userSchema } from '../models/user'

/**
 * Setup script to seed the database with admin and team users.
 * Run this after starting the application for the first time.
 * 
 * Usage: bun run scripts/setupUsers.ts
 */

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/scrumlens'

function generateRandomPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  
  for (let i = 0; i < 16; i++) {
    const randomByte = crypto.randomBytes(1)[0]
    password += chars[randomByte % chars.length]
  }
  
  // Shuffle the password
  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  
  return arr.join('')
}

async function setupUsers(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URL)
    console.log('Connected to MongoDB')
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ teamId: 'admin' })
    if (existingAdmin) {
      console.log('Admin user already exists. Skipping setup.')
      return
    }
    
    // Create admin user
    const adminUser = new User({
      name: 'Administrator',
      email: 'admin@scrumlens.local',
      password: generateRandomPassword(), // Will be hashed by pre-save hook
      teamId: 'admin',
      role: 'admin',
      isActive: true,
      isGuest: false,
    })
    
    await adminUser.save()
    console.log('Admin user created successfully')
    
    // Create team users (team1 to team24)
    const passwords: Record<string, string> = {}
    passwords['admin'] = (adminUser as any).password || 'NOT_SET'
    
    for (let i = 1; i <= 24; i++) {
      const teamId = `team${i}`
      
      // Check if user already exists
      const existingUser = await User.findOne({ teamId })
      if (existingUser) {
        console.log(`User ${teamId} already exists. Skipping.`)
        continue
      }
      
      const teamUser = new User({
        name: `Team ${i}`,
        email: `team${i}@scrumlens.local`,
        password: generateRandomPassword(), // Will be hashed by pre-save hook
        teamId: teamId,
        role: 'editor',
        isActive: true,
        isGuest: false,
      })
      
      await teamUser.save()
      passwords[teamId] = (teamUser as any).password || 'NOT_SET'
      console.log(`User ${teamId} created successfully`)
    }
    
    // Generate and display password report
    console.log('\n' + '='.repeat(60))
    console.log('PASSWORD REPORT - STORE SECURELY')
    console.log('='.repeat(60))
    console.log('\nAdmin Access:')
    console.log(`  Username: admin`)
    console.log(`  Password: ${passwords['admin']}`)
    
    console.log('\nTeam Access:')
    for (let i = 1; i <= 24; i++) {
      const teamId = `team${i}`
      console.log(`  ${teamId}: ${passwords[teamId]}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('Setup complete! Distribute passwords securely.')
    console.log('='.repeat(60))
    
    // Close connection
    await mongoose.disconnect()
    console.log('\nDisconnected from MongoDB')
  } catch (error) {
    console.error('Error setting up users:', error)
    process.exit(1)
  }
}

// Run setup
setupUsers()