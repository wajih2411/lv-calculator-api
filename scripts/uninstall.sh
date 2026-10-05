#!/usr/bin/env bash
set -euo pipefail

# Run from the repo root no matter where the script is called from.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

AUTO_APPROVE=""
CLEAN=0
for arg in "$@"; do
  case "$arg" in
    --auto-approve) AUTO_APPROVE="-auto-approve" ;;
    --clean) CLEAN=1 ;;
    *) echo "Usage: $0 [--auto-approve] [--clean]" >&2; exit 1 ;;
  esac
done

echo "WARNING: this deletes ALL AWS resources for this project (Lambda, API Gateway, IAM role, log group)."

# set -e stops the script here if destroy fails or is declined, so nothing below runs.
# shellcheck disable=SC2086 # intentionally unquoted: empty means no flag
terraform -chdir=terraform destroy $AUTO_APPROVE

if [ "$CLEAN" -eq 1 ]; then
  echo "==> Cleaning local files"
  # terraform.tfstate is deliberately never removed: it is the only record of what was deployed.
  rm -rf node_modules terraform/.terraform terraform/build
fi

echo "Uninstall complete."
