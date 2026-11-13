import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function hashPassword(password) {
    if (typeof password !== 'string' || password.length < 12) throw new Error('种子账号口令至少需要 12 个字符')
    const salt = randomBytes(16)
    const key = await scrypt(password, salt, 64, options)
    return `scrypt$${options.N}$${options.r}$${options.p}$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password, encoded) {
    const [algorithm, n, r, p, salt, key, extra] = encoded.split('$')
    if (algorithm !== 'scrypt' || +n !== options.N || +r !== options.r || +p !== options.p || extra || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(key)) return false
    const actual = await scrypt(password, Buffer.from(salt, 'hex'), 64, options)
    return timingSafeEqual(actual, Buffer.from(key, 'hex'))
}
