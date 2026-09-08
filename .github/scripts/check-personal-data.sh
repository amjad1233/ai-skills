#!/usr/bin/env bash
# Fails if tracked files contain personal/private data that shouldn't be in a
# public open-source repo. Intentionally public identifiers (the maintainer's
# name, the amjad1233 handle, the published owner email) are allowlisted.
#
# Run locally:  bash .github/scripts/check-personal-data.sh
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

# Public, intentional — never flag these.
PUBLIC_EMAILS='amjad1233@gmail.com'
# Usernames that are documentation placeholders, not a real home dir.
PLACEHOLDER_USERS='you|user|username|me|name|your-name|youruser|<user>|<you>'

# Don't scan the guard itself (its regexes would match) or the .git dir.
PATHSPEC=(':!.github/scripts/check-personal-data.sh' ':!.github/workflows/guard.yml')

fail=0
report() { # <title> <grep-output>
  if [[ -n "$2" ]]; then
    echo "::error::$1"
    echo "----- $1 -----"
    echo "$2"
    echo
    fail=1
  fi
}

# 1) Real home directories (e.g. /Users/amjad, /home/amjad) — allow placeholders.
home=$(git grep -nE '/(Users|home)/[A-Za-z0-9._-]+' -- "${PATHSPEC[@]}" 2>/dev/null \
  | grep -vEi "/(Users|home)/(${PLACEHOLDER_USERS})([/\"'[:space:]]|$)")
report "Absolute home directory path (use /Users/you placeholder instead)" "$home"

# 2) Email addresses other than the published public one.
emails=$(git grep -noE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' -- "${PATHSPEC[@]}" 2>/dev/null \
  | grep -vE "(${PUBLIC_EMAILS})")
report "Non-public email address" "$emails"

# 3) Known private/work domains.
domains=$(git grep -nEi '@?(doghouse\.agency|ajurapearls(\.com\.au)?)' -- "${PATHSPEC[@]}" 2>/dev/null)
report "Private/work domain reference" "$domains"

# 4) Telegram bot token shape (<digits>:<35 token chars>).
tg=$(git grep -nE '[0-9]{8,10}:[A-Za-z0-9_-]{35}' -- "${PATHSPEC[@]}" 2>/dev/null)
report "Possible Telegram bot token" "$tg"

if [[ $fail -ne 0 ]]; then
  echo "Personal-data check FAILED. Remove the items above (or allowlist them in"
  echo "$0 if they are genuinely public)."
  exit 1
fi
echo "Personal-data check passed — no personal data found."
