/**
 * server 启动入口（**开发/备用**，见 server/README.md）。
 *
 * ⚠️ 桌面端不启动本服务：`src-tauri/tauri.conf.json` 没有 `externalBin`，
 * `src-tauri/src/lib.rs` 也不 spawn 任何 Node 进程 —— 打包版唯一在跑的本地服务是
 * `src-tauri/src/bridge.rs`（Rust，同样监听 127.0.0.1:8000）。
 * 手动 `npm run server` 才能跑起来，仅用于独立调试 Node 侧逻辑。
 */
import { start } from './app.js'

const port = Number(process.env.PA_PORT ?? 8000)

start(port)
  .then((url) => console.log(`[pa-server] ready at ${url}`))
  .catch((err) => {
    console.error('[pa-server] failed to start', err)
    process.exit(1)
  })
