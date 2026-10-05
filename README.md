# lv-calculator-api

A small serverless API that estimates bandwidth and storage for a camera system.

## How it works

API Gateway -> Lambda (Node.js) -> JSON, with each calculation saved to DynamoDB. All AWS resources are provisioned with Terraform (see `terraform/`).

## Prerequisites

- Node.js (with npm)
- Terraform
- AWS CLI, configured (`aws configure`)
- An AWS account

## Install

```sh
./scripts/install.sh
```

This checks prerequisites, runs the tests, deploys to AWS, and prints the endpoint. Terraform asks for confirmation before deploying; pass `--auto-approve` to skip it.

## Example

```sh
curl -X POST "$(terraform -chdir=terraform output -raw calculate_endpoint)" \
  -H 'Content-Type: application/json' \
  -d '{"cameraCount": 10, "resolution": "1080p", "retentionDays": 30, "additionalLoadWatts": 50, "upsBatteryWh": 1000}'
```

```json
{
  "inputs": {
    "cameraCount": 10,
    "resolution": "1080p",
    "retentionDays": 30,
    "recordingHoursPerDay": 24,
    "wattsPerCamera": 12.95,
    "additionalLoadWatts": 50,
    "upsBatteryWh": 1000,
    "upsEfficiency": 0.9
  },
  "bitratePerCameraMbps": 4,
  "totalBandwidthMbps": 40,
  "storageTB": 12.96,
  "totalLoadWatts": 179.5,
  "heatLoadBtuPerHour": 612.5,
  "upsRuntimeMinutes": 300.8
}
```

Only `cameraCount`, `resolution` and `retentionDays` are required. `upsRuntimeMinutes` is `null` unless `upsBatteryWh` is given.

The response also includes an `id` and `createdAt`: every calculation is saved to DynamoDB and deleted automatically after 30 days.

## History

`GET /history` returns the most recent calculations, newest first. The optional `?limit=` accepts 1-50 (default 10).

```sh
curl "$(terraform -chdir=terraform output -raw history_endpoint)?limit=5"
```

```json
{
  "count": 1,
  "items": [
    {
      "id": "3f2b8c1e-5d47-4a90-9c1b-7e6a2d4f8b10",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "result": { "storageTB": 12.96, "totalBandwidthMbps": 40 }
    }
  ]
}
```

`result` holds the full calculation output (shortened here).

## Uninstall

```sh
./scripts/uninstall.sh
```

This deletes all AWS resources for this project (Terraform asks for confirmation; `--auto-approve` skips it). Add `--clean` to also remove local files (`node_modules`, `terraform/.terraform`, `terraform/build`) after a successful destroy.

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs on every pull request and every push to `main`:

- **Pull requests** run the unit tests and `terraform fmt` / `terraform validate`. They never touch AWS.
- **Pushes to `main`** run the same checks, then deploy with Terraform and smoke-test the live endpoint.

The deploy job authenticates to AWS with OIDC, so no access keys are stored in GitHub. It assumes a least-privilege deploy role that can only manage this project's resources, and only workflows on the `main` branch of this repo can assume it. The role's ARN is stored as the `AWS_ROLE_ARN` repository secret.

Terraform state lives in an S3 bucket with S3-native locking, so GitHub Actions and local runs share one state and can't apply at the same time.

The `bootstrap/` folder creates what the pipeline depends on: the state bucket, the GitHub OIDC provider, the deploy role, and the permissions boundary that caps what the app's own IAM roles can do. Run it once, locally, with your own AWS credentials:

```sh
terraform -chdir=bootstrap init
terraform -chdir=bootstrap apply
```

## Running tests

```sh
npm test
```
