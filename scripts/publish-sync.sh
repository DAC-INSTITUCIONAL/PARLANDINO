#!/usr/bin/env bash
# Guarda cada fragmento en la rama sync-temporal (que no publica la página) y
# solo sube plan-data.json a main cuando llegaron todos. Así GitHub Pages
# publica una vez por cada cambio del Excel, no una vez por fragmento.
set -euo pipefail

SYNC_BRANCH="${SYNC_BRANCH:-sync-temporal}"
SYNC_WT="${SYNC_WT:-${RUNNER_TEMP:-/tmp}/sync-temporal}"
export SYNC_ROOT="$SYNC_WT/.sync"

git config user.name "PMCA Sync"
git config user.email "actions@users.noreply.github.com"

prepare_sync_worktree() {
  rm -rf "$SYNC_WT"
  git worktree prune
  if git fetch -q origin "+refs/heads/$SYNC_BRANCH:refs/remotes/origin/$SYNC_BRANCH" 2>/dev/null; then
    git worktree add -q --detach "$SYNC_WT" "origin/$SYNC_BRANCH"
  else
    git worktree add -q --detach "$SYNC_WT" HEAD
    git -C "$SYNC_WT" checkout -q --orphan sync-nueva
    git -C "$SYNC_WT" rm -rqf .
  fi
}

push_sync_branch() {
  git -C "$SYNC_WT" add -A
  git -C "$SYNC_WT" diff --cached --quiet && return 0
  git -C "$SYNC_WT" commit -q -m "$1"
  git -C "$SYNC_WT" push -q origin "HEAD:refs/heads/$SYNC_BRANCH"
}

for attempt in $(seq 1 20); do
  git fetch -q origin main
  git reset -q --hard origin/main
  prepare_sync_worktree
  node scripts/receive-sync.mjs

  if [ -d "$SYNC_ROOT/$SYNC_ID" ]; then
    # Faltan fragmentos: guardar este en la rama temporal.
    if push_sync_branch "Fragmento $CHUNK_INDEX de $SYNC_ID"; then exit 0; fi
  else
    # Llegaron todos: publicar plan-data.json en main una sola vez.
    git add plan-data.json
    if git diff --cached --quiet || { git commit -q -m "Actualizar datos públicos del plan" && git push -q origin HEAD:main; }; then
      for cleanup in 1 2 3 4 5; do
        if push_sync_branch "Limpiar $SYNC_ID"; then exit 0; fi
        sleep $((cleanup + RANDOM % 3))
        prepare_sync_worktree
        rm -rf "${SYNC_ROOT:?}/$SYNC_ID"
      done
      echo "Datos publicados; no se pudo limpiar $SYNC_ID en $SYNC_BRANCH" >&2
      exit 0
    fi
  fi
  sleep $(( (attempt < 6 ? attempt : 6) + RANDOM % 4 ))
done
exit 1
