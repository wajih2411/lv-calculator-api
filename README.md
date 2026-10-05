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

## Running tests

```sh
npm test
```
