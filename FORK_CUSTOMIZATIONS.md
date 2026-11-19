# Fork customizations

本文件记录 `Fariacool/running_page` 相对上游 `yihong0618/running_page` 的**有意差异**。
同步上游后，逐项核对本文件；如果发现新的差异，要么是上游重构导致的路径变化，要么是合并时被静默覆盖，必须查清楚。

最后核对：2026-11-19，上游 `1730095e`。

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
| `.github/workflows/run_data_sync.yml` | cron、`run` 分支、Fariacool 的环境变量、Cloudflare WARP 三个 step | `git diff upstream/master -- .github/workflows/run_data_sync.yml` |
| `.github/workflows/gh-pages.yml` | `actions/checkout` 的 `ref: run` | `grep -n "ref: run" .github/workflows/gh-pages.yml` |
| `src/static/site-metadata.ts` | 站点标题、URL、description、navLinks | `grep -n "Fariacool" src/static/site-metadata.ts` |
| `src/themes/classic/utils/const.ts` | Mapbox token、`ROAD_LABEL_DISPLAY=false`、`PRIVACY_MODE=true` | `grep -n "ROAD_LABEL_DISPLAY = false\|PRIVACY_MODE = true" src/themes/classic/utils/const.ts` |
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

以及三个 WARP step：

- `Install Cloudflare WARP`
- `Connect Cloudflare WARP`
- `Disconnect Cloudflare WARP`

上游新增的同步步骤、Python 版本、参数修复要保留，不要因为解决冲突而丢掉。

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
