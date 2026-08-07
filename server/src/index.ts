/**
 * server 启动入口：被 Tauri sidecar 或 tsx 调用。
 */
import { start } from './app.js'

const port = Number(process.env.PA_PORT ?? 8000)

start(port)
  .then((url) => console.log(`[pa-server] ready at ${url}`))
  .catch((err) => {
    console.error('[pa-server] failed to start', err)
    process.exit(1)
  })
