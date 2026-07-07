import crypto from 'node:crypto'

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let arr = []
  
  // Ensure at least one number, uppercase, lowercase and special char
  arr.push(chars.substring(36, 46)[Math.floor(Math.random() * 10)]) // number
  arr.push(chars[Math.floor(Math.random() * 26)]) // lowercase
  arr.push(chars[26 + Math.floor(Math.random() * 26)]) // uppercase
  arr.push(chars[52 + Math.floor(Math.random() * 5)]) // special char
  
  for (let i = arr.length; i < 16; i++) {
    arr.push(chars[Math.floor(Math.random() * chars.length)])
  }
  
  // Shuffle using Fisher-Yates with crypto random
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(crypto.randomInt(0, i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  
  return arr.join('')
}

function generatePasswords() {
  const passwords = {}
  
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
  
  return mdContent
}

const content = generatePasswords()
console.log(content)