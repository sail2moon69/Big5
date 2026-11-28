// Password hashing, random tokens and encryption of stored results.
const crypto = require('crypto')

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

function scrypt (password, salt, { N, r, p, keylen }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

async function hashPassword (password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, SCRYPT)
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$')
}

async function verifyPassword (password, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false
  }
  const [, N, r, p, salt, hash] = parts
  const expected = Buffer.from(hash, 'base64')
  const key = await scrypt(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p), keylen: expected.length })
  return crypto.timingSafeEqual(key, expected)
}

// Burns roughly the same time as a real check, so a login for an unknown address
// can't be told apart from a wrong password by the response time.
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')
async function verifyDummy (password) {
  await verifyPassword(password, DUMMY_HASH)
  return false
}

function randomToken (bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url')
}

function sha256 (value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

// readable initial passwords for new trainer accounts (no 0/O, 1/l/I)
function generatePassword (length = 16) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
    if (i % 4 === 3 && i < length - 1) out += '-'
  }
  return out
}

function loadDataKey (value) {
  if (!value) {
    return null
  }
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) {
    throw new Error('BIG5_DATA_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)')
  }
  return key
}

// AES-256-GCM. The context (e.g. "result:17") is bound in as additional data, so an
// encrypted value copied into another row fails to decrypt instead of showing up there.
function encrypt (key, plaintext, context) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(context))
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':')
}

function decrypt (key, value, context) {
  const [version, iv, tag, data] = String(value).split(':')
  if (version !== 'v1') {
    throw new Error('unknown encryption format')
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAAD(Buffer.from(context))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyDummy,
  randomToken,
  sha256,
  generatePassword,
  loadDataKey,
  encrypt,
  decrypt
}
