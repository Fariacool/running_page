# 上游同步指南（AGENTS.md）

本文件是本仓库执行「同步上游 `yihong0618/running_page` master」的权威操作说明。
任何 AI Agent 或人，在做这件事之前都必须先读本文件，不要重新发明流程。

## 0. 仓库约定

| 名称 | 含义 |
|---|---|
| `origin` | `Fariacool/running_page`，你的 fork |
| `upstream` | `yihong0618/running_page`，只跟踪 `master` |
| `run` | 生产分支，包含 Fariacool 自己的跑步数据；GitHub 默认分支 |
| `master` | 上游镜像，只用于查看，不参与同步流程 |
| `origin/run` | 数据的唯一可信来源 |

**数据唯一来源是 `origin/run`。`upstream/master` 里也含有 yihong0618 的跑步数据，任何时候都不能进入 `run` 的文件树。**

`run` 分支的代码 = 上游代码 + 少量 fork 定制；数据 = Fariacool 自己的数据。
上游历史会作为 merge 的祖先进入 `run`，这是正常且必要的；被禁止的是上游数据出现在 `run` 当前文件树、PR diff 和部署产物里。

## 1. 绝对规则

1. 不允许把 `upstream/master` 直接合并进 `run`，必须走 `sync/upstream-YYYYMMDD` 分支 + PR。
2. 数据路径必须整路径取 `origin/run`，不允许逐文件 `git checkout --ours`，也不允许 `git merge -X ours`。
3. 唯一允许残留的冲突是 `.github/workflows/run_data_sync.yml`；出现其它冲突就停下来报告。
4. 不允许对 `run` 做 `force push`、`rebase`、`reset`。
5. 合并 PR 必须使用 merge commit，禁止 squash / rebase merge。
6. 不在本地安装 Node/Python 依赖；验收只认 GitHub Actions。
7. CI 未绿不得合并；数据 invariant 未通过不得提交。
8. 不允许 `git clean -fdx`，不允许删除 `FIT_OUT`、`GPX_OUT`、`TCX_OUT`、`Workouts`、`activities`、`run_page/data.db` 等用户数据。
9. 不确定的冲突，宁可 `git merge --abort` 并报告，不要猜。

## 2. 一次性配置

当前机器已经配好。换机器时执行：

```bash
git remote add upstream https://github.com/yihong0618/running_page.git
git config remote.upstream.fetch '+refs/heads/master:refs/remotes/upstream/master'

# 让 origin 抓取所有分支，否则 origin/run 不会更新
git config --replace-all remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git fetch origin --prune
git remote set-head origin -a

git fetch upstream --prune
git branch --set-upstream-to=origin/run run
```

说明：

- `upstream` 故意只 fetch `master`，避免把上游其它数据分支拉下来。
- `origin/HEAD` 应该指向 `run`。可以用 `git symbolic-ref refs/remotes/origin/HEAD` 检查。

## 3. 标准同步流程

### 3.1 开始合并

```bash
git fetch origin --prune
git fetch upstream --prune

scripts/sync-upstream.sh \
  --branch "sync/upstream-$(date +%Y%m%d)" \
  --tag
```

脚本会：

1. 从 `origin/run` 创建同步分支；
2. merge `upstream/master`（`--no-ff --no-commit`）；
3. 把所有数据路径强制恢复成合并前的 `run` 版本；
4. 断言数据区域和 base 完全一致；
5. 检查剩余冲突是否只有 `run_data_sync.yml`。

退出码：

| 退出码 | 含义 | 下一步 |
|---|---|---|
| `0` | 无冲突，可以提交 | 检查 diff 后提交 |
| `10` | 只剩 `run_data_sync.yml` 冲突 | 做语义合并，见 3.2 |
| `2` | 环境/前置条件错误 | 按提示修复 |
| `4` | 数据 invariant 失败 | 停止，不要提交，检查脚本输出 |
| `5` | 出现未预期冲突 | 停止并报告，或安全地 `git merge --abort` |

如果脚本以 `10` 退出，不要慌，这是预期路径。

### 3.2 解决 `run_data_sync.yml`

这个文件是 fork 自己的配置，不能简单取 ours，也不能简单取 theirs。

建议以 **upstream 版本为底**，重新应用 fork 设置：

```bash
git checkout --theirs -- .github/workflows/run_data_sync.yml
```

然后逐项确认下面这些 fork 设置仍然存在：

- `on.schedule.cron: '40 15 * * *'`
- `on.push.branches: [run]`
- `RUN_TYPE: garmin_sync_cn_global`
- `ATHLETE: Fariacool`
- `TITLE: Fariacool Running`
- `USE_CLOUDFLARE_WARP: true`
- `BIRTHDAY_MONTH: 1994-02`
- `publish_github_pages` 调用 `gh-pages.yml` 时的 `secrets: inherit`（上游尚未修，必须保留）

WARP 的 Install / Connect / Disconnect 三个 step 从 2026-11 起上游已经提供，确认它们仍在即可；fork 不需要再单独维护这三个 step。

同时保留上游新增的内容。以 2026-11 这次为例，上游新增了：

- `strava_web` 同步步骤
- Python 3.12
- `garmin_to_strava` 的 `--fit` 参数

纯引号风格、注释措辞之类的差异可以丢掉，目的是让 fork 的 diff 尽量小。

验证：

```bash
ruby -ryaml -e 'YAML.load_file(ARGV[0])' .github/workflows/run_data_sync.yml

# 这个 diff 应该只剩真正的 fork 定制
git diff upstream/master -- .github/workflows/run_data_sync.yml
```

理想的 diff 应该只有：cron、branch、几个 env 值、`secrets: inherit`。
如果还出现 WARP step 差异、大量引号/注释差异，说明没有清理干净，后续每次都会继续冲突。

`src/components/RouteMapCanvas.tsx` 里忽略 404 glyph/tile 的补丁也是 fork-only 的，见 `FORK_CUSTOMIZATIONS.md`，同步后不要丢。

### 3.3 提交前检查

```bash
# 1. 数据区域必须和 base 完全一致
#    脚本已经检查过；手工复核可以看：
git diff --name-only "$(git merge-base HEAD origin/run)" -- \
  assets ':(exclude)assets/index.tsx' ':(exclude)assets/start.svg' ':(exclude)assets/end.svg' \
  src/static/activities.json imported.json synced_activity.json run_page/data.db \
  FIT_OUT GPX_OUT TCX_OUT Workouts activities

# 2. fork 定制文件没有被静默覆盖
grep -n "Fariacool" src/static/site-metadata.ts
grep -n "ROAD_LABEL_DISPLAY = false" src/themes/classic/utils/const.ts
grep -n "PRIVACY_MODE = true" src/themes/classic/utils/const.ts
grep -n "ref: run" .github/workflows/gh-pages.yml
grep -n "secrets: inherit" .github/workflows/run_data_sync.yml
grep -n "404|not found" src/components/RouteMapCanvas.tsx

# 3. 确认 site-metadata 的导入仍然指向 fork 的文件
git grep -n "site-metadata" -- src

# 4. 新增的 assets 文件必须人工确认不是上游数据
git diff --cached --diff-filter=A --name-only "$(git merge-base HEAD origin/run)" -- assets
```

提交：

```bash
git add -A
git commit -m "Merge upstream/master into run ($(date +%F))"
```

### 3.4 推送并创建 PR

```bash
BRANCH=$(git branch --show-current)
git push -u origin "$BRANCH"

gh pr create \
  --base run \
  --head "$BRANCH" \
  --title "chore: sync upstream master $(date +%F)" \
  --body "Upstream: yihong0618/running_page@$(git rev-parse --short upstream/master)
Base: $(git rev-parse --short HEAD^2)
Data invariant: PASS
Conflicts: only .github/workflows/run_data_sync.yml
CI: pending"
```

PR 的 diff 里不应该出现任何数据文件。如果出现，说明数据覆盖逻辑失败，关闭 PR 重来。

### 3.5 等 CI

```bash
gh pr checks --watch
```

失败时：

```bash
gh run list --branch "$(git branch --show-current)" --limit 5
gh run view <run-id> --log-failed
```

规则：

- 只读 CI 日志，不在本地安装依赖；
- 修复后继续 commit + push，最多 3 轮；
- 如果失败原因需要产品/数据决策，停下来报告，不要为了变绿而删数据或回退上游代码。

### 3.6 合并

CI 绿后：

```bash
gh pr merge --merge --delete-branch
```

必须用 `--merge`，不要 `--squash`，不要 `--rebase`。
原因：squash 后上游提交不再是 `run` 的祖先，下一次 merge base 会退回去，冲突会重复出现。

### 3.7 合并后

```bash
git switch run
git pull --ff-only

# 如果 merge 改了 run_page/ 下的同步脚本，push 会自动触发 Run Data Sync
gh run list --workflow=run_data_sync.yml --branch=run --limit 1

# 没自动触发时再手动触发
gh workflow run run_data_sync.yml --ref run
gh run watch <run-id>
```

数据同步会用你自己的数据库重新生成 `activities.json` 和 SVG，这是合并后的真正集成验证。
如果它失败，站点仍会停留在上一次成功部署，不会立刻坏掉；修复后再推一次。

dashboard 地图：如果 footer 显示“备用底图 · CARTO”或“底图加载失败”，先检查仓库 secret `MAPBOX_TOKEN` 和 `run_data_sync.yml` 的 `secrets: inherit`；细节见 `FORK_CUSTOMIZATIONS.md`。

## 4. 冲突决策表

| 冲突/变更 | 处理 |
|---|---|
| `assets/github*.svg`、`grid.svg`、`mol*.svg`、`year_*.svg`、`year_summary*.svg` | 取 `run`；脚本自动处理 |
| `src/static/activities.json`、`imported.json`、`synced_activity.json`、`run_page/data.db` | 取 `run`；脚本自动处理 |
| `FIT_OUT/`、`GPX_OUT/`、`TCX_OUT/`、`Workouts/`、`activities/` | 取 `run`；脚本自动处理 |
| `.github/workflows/run_data_sync.yml` | 语义合并，见 3.2 |
| `.github/workflows/gh-pages.yml` | 保留 `ref: run`，其余取上游 |
| `src/static/site-metadata.ts` | 保留 Fariacool 的标题/URL/nav |
| `src/themes/classic/utils/const.ts`（原 `src/utils/const.ts`） | 保留 Mapbox token、`ROAD_LABEL_DISPLAY=false`、`PRIVACY_MODE=true` |
| `run_page/synced_data_file_logger.py` | 保留 `indent=2` 和结尾换行 |
| 其它代码冲突 | 默认取上游；如果碰到 `FORK_CUSTOMIZATIONS.md` 里的文件，按该文件说明保留 fork 部分 |
| 未知的新数据文件/目录 | 停止，人工确认；不要默认接收上游版本 |

## 5. 失败与回滚

### 还没提交

```bash
git merge --abort
git switch run
git branch -D sync/upstream-YYYYMMDD
```

### 已经推送但还没合并

关闭 PR 即可，`run` 不受影响。

### 已经合并进 `run`

不要 `reset` / `force push`。用 revert：

```bash
git switch -c revert/upstream-YYYYMMDD origin/run
git revert -m 1 <merge-sha>
git push -u origin HEAD
gh pr create --base run
```

### 数据同步失败

- 站点会保持上一次成功部署；
- 先看 `gh run view <run-id> --log-failed`；
- 不要为了重跑而删除 `run_page/data.db` 或 `FIT_OUT`；
- 修复后重新触发 `run_data_sync.yml`。

## 6. 不要做的事

- 不要用 `git merge -X ours`：上游新增/修改的数据文件会以「非冲突」方式被接受。
- 不要用 `.gitattributes merge=ours`：需要每台机器配置，而且处理不了 modify/delete、add/add。
- 不要逐文件 `git checkout --ours -- assets/...`：文件列表每年都会变，容易漏。
- 不要直接 push `run`，也不要 squash merge。
- 不要 `git clean -fdx`。
- 不要在本地 `pnpm install` / `pip install` 来「先跑一下」；CI 是唯一验收环境。
- 不要把上游的新 `assets/*.svg` 当成静态资源直接接收；先确认它是不是数据产物。
- 不要在上游重构后只相信「没有冲突」：`src/utils/const.ts` 被移动到 `src/themes/classic/utils/const.ts` 这类变化，Git 可能静默处理，必须做语义检查。

## 7. 相关文件

- `scripts/sync-upstream.sh`：确定性合并脚本，数据策略的唯一实现。
- `FORK_CUSTOMIZATIONS.md`：相对上游的有意差异清单，合并后逐项核对。
- `.github/workflows/ci.yml`：PR 的构建/测试门禁。
- `.github/workflows/run_data_sync.yml`：合并后重新生成数据的 workflow。
- `.github/workflows/gh-pages.yml`：部署 workflow，checkout 的 `ref` 必须是 `run`。

## 8. 报告模板

同步完成后，向用户报告：

```text
上游范围: <base-sha>..<upstream-sha>（N commits）
同步分支: sync/upstream-YYYYMMDD
冲突处理: 仅 run_data_sync.yml（保留了哪些 fork 设置，吸收了哪些上游变更）
数据 invariant: PASS
CI: <PR / run 链接>
数据同步: <run 链接，成功/失败>
剩余风险: <无 / 具体项>
```
