#!/usr/bin/env bash
set -euo pipefail

# Run from the repo root no matter where the script is called from.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

AUTO_APPROVE=""
for arg in "$@"; do
  case "$arg" in
    --auto-approve) AUTO_APPROVE="-auto-approve" ;;
    *) echo "Usage: $0 [--auto-approve]" >&2; exit 1 ;;
  esac
done

install_hint() {
  case "$1" in
    node|npm)  echo "https://nodejs.org/en/download (or: brew install node)" ;;
    terraform) echo "https://developer.hashicorp.com/terraform/install (or: brew install hashicorp/tap/terraform)" ;;
    aws)       echo "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html (or: brew install awscli)" ;;
    curl)      echo "https://curl.se/download.html (or: brew install curl)" ;;
  esac
}

missing=0
for cmd in node npm terraform aws curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing prerequisite: $cmd - install it from $(install_hint "$cmd")" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials are not working. Run 'aws configure' and try again." >&2
  exit 1
fi

echo "==> Installing dependencies"
npm ci

echo "==> Running tests"
npm test

echo "==> Deploying with Terraform"
terraform -chdir=terraform init
# shellcheck disable=SC2086 # intentionally unquoted: empty means no flag
terraform -chdir=terraform apply $AUTO_APPROVE

ENDPOINT="$(terraform -chdir=terraform output -raw calculate_endpoint)"
echo
echo "Calculate endpoint: $ENDPOINT"

echo "==> Smoke test (10 cameras, 1080p, 30 days)"
curl -sS --fail-with-body -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{"cameraCount": 10, "resolution": "1080p", "retentionDays": 30}'
echo
