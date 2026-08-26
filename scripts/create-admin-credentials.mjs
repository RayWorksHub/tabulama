import { randomBytes, scryptSync } from 'node:crypto'

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('A parancsot interaktív terminálban futtasd.')
  }

  return new Promise((resolve) => {
    let value = ''
    process.stdout.write(prompt)
    process.stdin.setRawMode(true)
    process.stdin.setEncoding('utf8')
    process.stdin.resume()

    const finish = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener('data', onData)
      process.stdout.write('\n')
      resolve(value)
    }

    const onData = (character) => {
      if (character === '\u0003') {
        process.stdout.write('\n')
        process.exit(130)
      }
      if (character === '\r' || character === '\n') return finish()
      if (character === '\u007f' || character === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1)
          process.stdout.write('\b \b')
        }
        return
      }
      value += character
      process.stdout.write('*')
    }

    process.stdin.on('data', onData)
  })
}

const password = await readHidden('Új adminjelszó (legalább 12 karakter): ')
if (password.length < 12) {
  console.error('A jelszó túl rövid.')
  process.exit(1)
}

const confirmation = await readHidden('Adminjelszó újra: ')
if (password !== confirmation) {
  console.error('A két jelszó nem egyezik.')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64)

console.log(`ADMIN_PASSWORD_HASH=${salt.toString('hex')}:${hash.toString('hex')}`)
console.log(`ADMIN_SESSION_SECRET=${randomBytes(48).toString('base64url')}`)
