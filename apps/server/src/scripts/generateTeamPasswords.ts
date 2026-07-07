import crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

function generatePasswords(): void {
  const passwords: Record<string, string> = {}
  
  // Admin user
  passwords['admin'] = generateRandomPassword()
  
  // Team users team1 through team24
  for (let i = 1; i <= 24; i++) {
    passwords[`team${i}`] = generateRandomPassword()
  }
  
  let mdContent = '# Scrumlens Team Passwords\n'
  mdContent += '\n> **IMPORTANT**: Store this file securely. Delete it after distributing passwords.\n\n'
  mdContent += '## Admin Access\n\n'
  mdContent += '| Username | Password |\n|----------|----------|\n'
  mdContent += `| admin | \`${passwords['admin']}\` |\n\n`
  mdContent += '## Team Access (24 Teams)\n\n'
  mdContent += '| Username | Password | Team |\n|----------|----------|------|\n'
  
  for (let i = 1; i <= 24; i++) {
    mdContent += `| team${i} | \`${passwords[`team${i}`]}\` | Team ${i} |\n`
  }
  
  mdContent += '\n## Access Rules\n\n'
  mdContent += '- All members of **Team X** use credentials: `teamX` / `<password>`\n'
  mdContent += '- Admin user `admin` can view all team boards\n'
  mdContent += '- Users can only edit boards belonging to their team\n\n'
  mdContent += '## Security Notes\n\n'
  mdContent += '- Change these passwords after initial setup if needed\n'
  mdContent += '- Consider implementing password expiration policy\n'
  mdContent += '- This file should be deleted or secured after distributing credentials\n'
  
  // Write to passwords.md in project root
  const rootDir = path.resolve(__dirname, '../../../..')
  const filePath = path.join(rootDir, 'passwords.md')
  fs.writeFileSync(filePath, mdContent)
  
  console.log(mdContent)
  console.log('\nPasswords generated successfully and saved to passwords.md')
}

generatePasswords()