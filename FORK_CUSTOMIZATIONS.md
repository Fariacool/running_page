# Fork customizations

本文件记录 `Fariacool/running_page` 相对上游 `yihong0618/running_page` 的**有意差异**。
同步上游后，逐项核对本文件；如果发现新的差异，要么是上游重构导致的路径变化，要么是合并时被静默覆盖，必须查清楚。

最后核对：2026-11-19，上游 `1730095e`。本次另有两个上游尚未修复的 fork-only 补丁，见第 2 节。

## 1. 数据所有权

以下路径永远属于 `run` 分支，**不接受 upstream 版本**。`scripts/sync-upstream.sh` 会自动处理。

```text
assets/github.svg
assets/github_[0-9]*.svg
assets/grid.svg
assets/mol*.svg
assets/year_[0-9]*.svg
assets/year_summary*.svg
src/static/activities.json
imported.json
synced_activity.json
run_page/data.db
FIT_OUT/
GPX_OUT/
TCX_OUT/
Workouts/
activities/
```

不是数据、不要覆盖的：

```text
assets/index.tsx        # 代码
assets/start.svg        # 静态地图标记
assets/end.svg          # 静态地图标记
```

## 2. 有意的代码/配置差异

| 文件 | fork 的差异 | 核对方式 |
|---|---|---|
| `.github/workflows/run_data_sync.yml` | cron、`run` 分支、Fariacool 的环境变量；WARP 三个 step 上游已提供，fork 只把开关设为 true；`publish_github_pages` 显式传 `MAPBOX_TOKEN`（上游尚未修） | `git diff upstream/master -- .github/workflows/run_data_sync.yml` |
| `.github/workflows/gh-pages.yml` | `actions/checkout` 的 `ref: run`；`workflow_call` 声明可选 secret `MAPBOX_TOKEN`（上游尚未修） | `grep -n "ref: run" .github/workflows/gh-pages.yml` |
| `src/static/site-metadata.ts` | 站点标题、URL、description、navLinks | `grep -n "Fariacool" src/static/site-metadata.ts` |
| `src/themes/classic/utils/const.ts` | Mapbox token、`ROAD_LABEL_DISPLAY=false`、`PRIVACY_MODE=true` | `grep -n "ROAD_LABEL_DISPLAY = false\|PRIVACY_MODE = true" src/themes/classic/utils/const.ts` |
| `src/components/RouteMapCanvas.tsx` | 只处理 Mapbox 401/403 fallback；`style.load` 即 ready；其它 tile/glyph/abort 不改变整张地图状态（上游尚未修） | `grep -n "setStatus('ready')" src/components/RouteMapCanvas.tsx` |
| `run_page/synced_data_file_logger.py` | `json.dump(..., indent=2)` 和结尾换行 | `grep -n "indent=2" run_page/synced_data_file_logger.py` |

### `run_data_sync.yml` 必须保留的 fork 设置

```yaml
on:
  schedule:
    - cron: '40 15 * * *'
  push:
    branches:
      - run

env:
  RUN_TYPE: garmin_sync_cn_global
  ATHLETE: Fariacool
  TITLE: Fariacool Running
  USE_CLOUDFLARE_WARP: true
  BIRTHDAY_MONTH: 1994-02
```

WARP 的三个 step（`Install` / `Connect` / `Disconnect`）从 2026-11 起上游已经提供；fork 只需要保留 `USE_CLOUDFLARE_WARP: true`，并确认这三个 step 没有被上游删除。如果上游以后移除它们，再把它们作为 fork 差异补回来。

上游新增的同步步骤、Python 版本、参数修复要保留，不要因为解决冲突而丢掉。

`publish_github_pages` 里的显式 `MAPBOX_TOKEN` 传递是 fork-only 的修复：`Run Data Sync` 通过 reusable workflow 调用 `gh-pages.yml` 时，必须把 `MAPBOX_TOKEN` 传过去，否则 dashboard 的 `VITE_MAPBOX_TOKEN` 会是空值。这里刻意不使用 `secrets: inherit`，避免把 Garmin/Strava/Keep 等其它 repository secrets 一并暴露给 Pages workflow。上游目前还没修，所以同步后必须保留这段。

```yaml
    secrets:
      MAPBOX_TOKEN: ${{ secrets.MAPBOX_TOKEN }}
```

### Mapbox token（dashboard 3.0）

- 仓库 secret `MAPBOX_TOKEN` 提供 `VITE_MAPBOX_TOKEN`。
- `config.yml` 的 `mapbox_token` 保持为空，不要把 token 提交进仓库。
- `run_data_sync.yml` 调用 `gh-pages.yml` 必须显式传 `MAPBOX_TOKEN`，否则数据同步触发的 Pages 构建拿不到 token。
- 不要使用 `secrets: inherit`；只传 `MAPBOX_TOKEN`，避免把 Garmin/Strava/Keep 等 secrets 一起传过去。
- 验证方式：
  - Pages 构建日志里 `VITE_MAPBOX_TOKEN: ***`（不是空）；
  - 部署后的 `config-*.js` 里能搜到 `pk.`（`mapbox_token` 字段本身仍然是空的，这是设计如此）；
  - 页面地图 footer 显示“底图 · Mapbox”，不是“备用底图 · CARTO”。
- Vercel preview 不读取 GitHub Actions secret。如果 Vercel 的 Preview 环境没有设置 `VITE_MAPBOX_TOKEN`，预览站会使用 CARTO，这是预期行为；要在预览站用 Mapbox，需要单独配置一个允许 preview 域名的 token。

## 3. 上游重构注意事项

### 2026-11：`src/` 拆分为主题

上游把大部分 `src/` 代码移动到 `src/themes/classic/`，包括：

```text
src/utils/const.ts -> src/themes/classic/utils/const.ts
```

Git 的 rename 检测通常会把 fork 的 token / 隐私设置带过去，但合并后必须检查：

```bash
git ls-files | grep 'utils/const.ts'
grep -n "ROAD_LABEL_DISPLAY = false\|PRIVACY_MODE = true" src/themes/classic/utils/const.ts
```

另外上游新增了：

```text
src/themes/classic/static/site-metadata.ts
```

当前 fork 的 `src/static/site-metadata.ts` 仍被 `src/core/hooks/useSiteMetadata.ts` 导入，是生效的那个。以后如果上游改了导入路径，需要把 fork 的字段迁移到新文件，否则站点标题会静默变回上游默认值。

检查导入：

```bash
git grep -n "site-metadata" -- src
```

## 4. 合并后的核对命令

```bash
# 数据区域必须和同步 base 完全一致
# scripts/sync-upstream.sh 已经断言

# fork 定制文件
grep -n "Fariacool" src/static/site-metadata.ts
grep -n "ROAD_LABEL_DISPLAY = false" src/themes/classic/utils/const.ts
grep -n "PRIVACY_MODE = true" src/themes/classic/utils/const.ts
grep -n "ref: run" .github/workflows/gh-pages.yml
grep -n 'MAPBOX_TOKEN: ${{ secrets.MAPBOX_TOKEN }}' .github/workflows/run_data_sync.yml
! grep -q "secrets: inherit" .github/workflows/run_data_sync.yml
grep -n "MAPBOX_TOKEN" .github/workflows/gh-pages.yml
grep -n "setStatus('ready')" src/components/RouteMapCanvas.tsx
grep -n "indent=2" run_page/synced_data_file_logger.py

# site-metadata 的导入仍然指向 fork 文件
git grep -n "site-metadata" -- src

# 新增的 assets 文件（人工确认不是上游数据）
git diff --cached --diff-filter=A --name-only "$(git merge-base HEAD origin/run)" -- assets
```

## 5. 维护方式

- 只有**有意**改变 fork 行为时才更新本文件；
- 每次同步上游后，如果上游移动了这些文件，更新路径；
- 如果某个差异被上游接受并合入，删除对应条目；
- 不确定的新差异，先不要写进来，先查清楚来源。
