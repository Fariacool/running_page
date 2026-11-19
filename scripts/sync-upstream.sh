#!/usr/bin/env bash
#
# Merge yihong0618/running_page master into this fork's run branch while
# keeping every running-data file owned by the fork.
#
# The script:
#   1. fetches origin/run and upstream/master (unless --no-fetch)
#   2. creates a sync branch from the fork's run branch
#   3. starts a merge commit (--no-ff --no-commit)
#   4. forces every data path back to the fork's version
#   5. verifies that the data area is byte-for-byte identical to the base
#   6. allows only the fork-owned workflow file to remain conflicted
#
# It intentionally does NOT commit: the workflow file needs a semantic review.
#
# Exit codes:
#   0   ready to commit; no conflicts left
#   10  only .github/workflows/run_data_sync.yml remains conflicted
#   2   setup or precondition error
#   4   data invariant failed
#   5   unexpected conflicts remain
#
set -euo pipefail

REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-master}"
BASE_REF="${BASE_REF:-origin/run}"
ALLOWED_CONFLICT=".github/workflows/run_data_sync.yml"

# Data paths are owned by the fork. Never accept upstream copies.
# Keep this list in sync with AGENTS.md and FORK_CUSTOMIZATIONS.md.
DATA_PATHS=(
  ':(glob)assets/github.svg'
  ':(glob)assets/github_[0-9]*.svg'
  ':(glob)assets/grid.svg'
  ':(glob)assets/mol*.svg'
  ':(glob)assets/year_[0-9]*.svg'
  ':(glob)assets/year_summary*.svg'
  'src/static/activities.json'
  'imported.json'
  'synced_activity.json'
  'run_page/data.db'
  'FIT_OUT'
  'GPX_OUT'
  'TCX_OUT'
  'Workouts'
  'activities'
)

# git ls-tree does not accept the ":(glob)" magic; keep a plain-pathspec copy
# for restoring files from the base commit.
DATA_LS_PATHS=()
for path in "${DATA_PATHS[@]}"; do
  DATA_LS_PATHS+=("${path#:(glob)}")
done

BRANCH=""
DO_FETCH=1
RESOLVE_ONLY=0
CREATE_TAG=0

usage() {
  cat <<'EOF'
Usage: scripts/sync-upstream.sh [options]

Options:
  --branch NAME     Branch to create (default: sync/upstream-YYYYMMDD)
  --base REF        Base ref (default: origin/run)
  --no-fetch        Do not fetch origin/upstream
  --resolve-only    Resolve a merge that is already in progress
  --tag             Create pre-upstream-YYYYMMDD tag at the base
  -h, --help        Show this help

Typical use:
  scripts/sync-upstream.sh --branch sync/upstream-$(date +%Y%m%d) --tag

Exit codes:
  0   ready to commit; no conflicts left
  10  only .github/workflows/run_data_sync.yml remains conflicted
  2   setup or precondition error
  4   data invariant failed
  5   unexpected conflicts remain
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --branch)
      BRANCH="${2:?--branch needs a value}"
      shift 2
      ;;
    --base)
      BASE_REF="${2:?--base needs a value}"
      shift 2
      ;;
    --no-fetch)
      DO_FETCH=0
      shift
      ;;
    --resolve-only)
      RESOLVE_ONLY=1
      shift
      ;;
    --tag)
      CREATE_TAG=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "ERROR: not inside a git repository." >&2
  exit 2
}
cd "$ROOT"

require_clean_worktree() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: working tree is not clean." >&2
    echo "Commit or stash your changes before starting a sync." >&2
    git status --short >&2
    exit 2
  fi
}

check_upstream_remote() {
  local url
  if ! url=$(git remote get-url "$REMOTE" 2>/dev/null); then
    cat >&2 <<EOF
ERROR: git remote '$REMOTE' is not configured.

One-time setup:
  git remote add upstream https://github.com/yihong0618/running_page.git
  git config remote.upstream.fetch '+refs/heads/master:refs/remotes/upstream/master'
  git fetch upstream --prune
EOF
    exit 2
  fi

  case "$url" in
    *yihong0618/running_page*)
      ;;
    *)
      echo "ERROR: '$REMOTE' does not point to yihong0618/running_page:" >&2
      echo "  $url" >&2
      exit 2
      ;;
  esac
}

if [ "$RESOLVE_ONLY" -eq 1 ]; then
  if ! git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
    echo "ERROR: --resolve-only requires a merge in progress (MERGE_HEAD)." >&2
    exit 2
  fi
  BASE=$(git rev-parse HEAD)
  echo "Resolving merge in progress. Data base: $BASE"
else
  require_clean_worktree
  check_upstream_remote

  if git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
    echo "ERROR: a merge is already in progress; rerun with --resolve-only." >&2
    exit 2
  fi

  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "ERROR: git remote 'origin' is not configured." >&2
    exit 2
  fi

  if ! git config --get-all remote.origin.fetch \
    | grep -Fq 'refs/heads/*:refs/remotes/origin/*'; then
    echo "WARNING: origin does not fetch all branches. Run:" >&2
    echo "  git config --replace-all remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'" >&2
  fi

  if [ "$DO_FETCH" -eq 1 ]; then
    echo "Fetching origin and $REMOTE..."
    git fetch origin --prune
    git fetch "$REMOTE" --prune
  fi

  BASE=$(git rev-parse --verify "$BASE_REF" 2>/dev/null) || {
    echo "ERROR: cannot resolve base ref '$BASE_REF'." >&2
    exit 2
  }

  UPSTREAM_REF="$REMOTE/$UPSTREAM_BRANCH"
  if ! git rev-parse --verify "$UPSTREAM_REF" >/dev/null 2>&1; then
    echo "ERROR: '$UPSTREAM_REF' does not exist. Run: git fetch $REMOTE --prune" >&2
    exit 2
  fi

  if git merge-base --is-ancestor "$UPSTREAM_REF" "$BASE"; then
    echo "Already up to date: $UPSTREAM_REF is an ancestor of $BASE."
    exit 0
  fi

  if [ -z "$BRANCH" ]; then
    BRANCH="sync/upstream-$(date +%Y%m%d)"
  fi

  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "ERROR: branch '$BRANCH' already exists. Pick another --branch." >&2
    exit 2
  fi

  if [ "$CREATE_TAG" -eq 1 ]; then
    TAG="pre-upstream-$(date +%Y%m%d)"
    if git show-ref --verify --quiet "refs/tags/$TAG"; then
      echo "Tag '$TAG' already exists; leaving it unchanged."
    else
      git tag "$TAG" "$BASE"
      echo "Created backup tag: $TAG"
      echo "Push it with: git push origin $TAG"
    fi
  fi

  echo "Creating '$BRANCH' from '$BASE_REF' ($BASE)"
  git switch -c "$BRANCH" "$BASE"

  echo "Merging '$UPSTREAM_REF'..."
  if git merge --no-ff --no-commit "$UPSTREAM_REF"; then
    echo "Merge completed without conflicts."
  else
    echo "Merge has conflicts; applying the data ownership policy."
  fi

  if ! git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
    echo "ERROR: the merge did not start; inspect the output above." >&2
    exit 2
  fi
fi

echo "Enforcing fork ownership for data paths..."
git rm -r -f -q --ignore-unmatch -- "${DATA_PATHS[@]}"

# Restore every data file that exists in the base commit. Building the list
# from git avoids pathspec errors when an optional pattern is absent.
if [ "$(git ls-tree -r -z --name-only "$BASE" -- "${DATA_LS_PATHS[@]}" | wc -c)" -gt 0 ]; then
  git ls-tree -r -z --name-only "$BASE" -- "${DATA_LS_PATHS[@]}" \
    | xargs -0 git checkout "$BASE" --
fi

# The data area must be byte-for-byte identical to the fork's base commit.
if ! git diff --quiet "$BASE" -- "${DATA_PATHS[@]}"; then
  echo "ERROR: data paths differ from $BASE in the working tree." >&2
  git diff --stat "$BASE" -- "${DATA_PATHS[@]}" >&2
  exit 4
fi

if ! git diff --cached --quiet "$BASE" -- "${DATA_PATHS[@]}"; then
  echo "ERROR: data paths differ from $BASE in the index." >&2
  git diff --cached --stat "$BASE" -- "${DATA_PATHS[@]}" >&2
  exit 4
fi

CONFLICTS=$(git diff --name-only --diff-filter=U)
if [ -n "$CONFLICTS" ]; then
  UNEXPECTED=$(printf '%s\n' "$CONFLICTS" | grep -F -x -v "$ALLOWED_CONFLICT" || true)
  if [ -n "$UNEXPECTED" ]; then
    echo "ERROR: unexpected conflicts remain:" >&2
    printf '%s\n' "$UNEXPECTED" >&2
    echo "Resolve them if they are safe, or abort with: git merge --abort" >&2
    exit 5
  fi
fi

# Anything newly added under assets/ is either a static asset or a generated
# file type missing from DATA_PATHS. Both need a human/agent decision.
ADDED_ASSETS=$(git diff --cached --diff-filter=A --name-only "$BASE" -- assets || true)
if [ -n "$ADDED_ASSETS" ]; then
  echo "WARNING: new files under assets/ remain after the data overlay:" >&2
  printf '%s\n' "$ADDED_ASSETS" >&2
  echo "Confirm they are static/code assets, not upstream running data." >&2
fi

if ! git diff --quiet "$BASE" -- "$ALLOWED_CONFLICT"; then
  echo "NOTE: $ALLOWED_CONFLICT changed in this merge; review the fork settings."
fi

if [ -z "$BRANCH" ]; then
  BRANCH=$(git branch --show-current)
fi

echo
echo "Data invariant: PASS (all data paths match $BASE)"
echo "Branch: $BRANCH"

if [ -n "$CONFLICTS" ]; then
  echo "Only the allowed workflow conflict remains: $ALLOWED_CONFLICT"
  echo
  echo "Next:"
  echo "  1. Resolve $ALLOWED_CONFLICT (start from upstream and re-apply fork settings)."
  echo "  2. ruby -ryaml -e 'YAML.load_file(ARGV[0])' $ALLOWED_CONFLICT"
  echo "  3. git diff upstream/$UPSTREAM_BRANCH -- $ALLOWED_CONFLICT"
  echo "  4. git add -A && git commit -m 'Merge upstream/$UPSTREAM_BRANCH into run'"
  echo "  5. git push -u origin $BRANCH"
  echo "  6. gh pr create --base run --head $BRANCH"
  exit 10
fi

echo
echo "No conflicts remain."
echo "Next:"
echo "  1. Review the diff, especially $ALLOWED_CONFLICT."
echo "  2. git add -A && git commit -m 'Merge upstream/$UPSTREAM_BRANCH into run'"
echo "  3. git push -u origin $BRANCH"
echo "  4. gh pr create --base run --head $BRANCH"
exit 0
