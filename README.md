# Programmer Simulator · DEVLIFE

A Chinese text-based developer career simulator adapted from [VickScarlet/remake](https://github.com/VickScarlet/remake), under the MIT license. Choose talents and starting attributes, then make eight key dialogue decisions during a nine-year career across 36 quarters and six endings. Choices affect future events and career outcomes; autoplay pauses until you answer.

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
