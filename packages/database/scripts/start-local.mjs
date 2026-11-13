import { postgresControl } from './local-postgres.mjs'
import { createApp } from '../server.mjs'

await postgresControl('start')
const app = await createApp()
app.server.listen(8787, '127.0.0.1', () => console.log('程序员职业生涯模拟系统已启动：http://127.0.0.1:8787'))
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0) })
