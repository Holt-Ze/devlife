# Student Career Simulator · DEVLIFE

A Chinese text-based career simulator adapted from [VickScarlet/remake](https://github.com/VickScarlet/remake), under the MIT license. Choose one of six majors and play through four years of university and the first year after graduation. Course projects, internships, and capstones shape which paths open at graduation. The original 36-quarter developer career has its own entry on the home screen. Autoplay pauses for decisions and resumes after you answer.

See [中文说明](./README-zh_CN.md) for gameplay, content locations and validation.

## Run

Node.js 22.12+ (24 recommended), pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build:web
pnpm typecheck
```

Bun 1.4.2 is additionally used for `pnpm test` and the optional console client. The themed content is authored directly in TypeScript; no spreadsheet generation step is required.

Local saves use the separate `devlife:v1:` namespace. Completed career history, achievements and a retained talent are saved; in-progress careers do not resume after refresh.

Original license and attribution are retained in LICENSE.
