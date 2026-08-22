# RecoFree Backup Readiness Checklist

**Date:** 2026-08-22  
**Production backend:** Railway  
**Manus project type:** Mobile App / Expo

> The user's in-app notice and email are the source of truth for whether the account is affected and whether it is Type A/B or Type C.[1]

## Official timing

| Event | Time |
|---|---|
| Backup deadline | August 23, 2026 at 7:59 a.m. Singapore Time |
| Service-unavailable period | August 23 at 8:00 a.m. through August 25 at 7:59 a.m. Singapore Time |
| Restoration opens | August 25, 2026 at 8:00 a.m. Singapore Time |

Every Manus export is a fixed point-in-time snapshot. It does not update when RecoFree changes later. A fresh final export is therefore required after the last code/checkpoint changes.[2]

## Required before the deadline

| Check | Required action | Status |
|---|---|---|
| Account scope | Check the in-app notice and email for account type and affected status | User confirmation required |
| Type C account | Create **Account Info Backup first** | Only if notice says Type C |
| Task backup | Open [manus.im/backup](https://manus.im/backup) | Required if affected |
| Broadest export | Select **Export task data → Export more → All tasks → All time → Start export** | Required |
| Final snapshot | Repeat the export after the final RecoFree checkpoint/push | Required |
| Packages | Confirm every package exists at the chosen destination | Required |
| Package integrity | Do not rename packages or mix split parts between export runs | Required |
| Team workspace | Team owner must separately export team data | If applicable |
| Local source backup | Keep the generated RecoFree Git bundle, clean source ZIP and working-tree archive | Required redundancy |
| APK retention | Keep a local copy of the latest known-good APK; Task Data Backup is not guaranteed to contain every old compiled APK | Strongly recommended |
| GitHub | Confirm `main` contains the final commit | Required redundancy |
| Railway | Confirm root and `/api/health` are live | Required production check |

## What remains operational

RecoFree's installed APK is a device copy and is not served by Manus when opened. Its production GPT proxy is on Railway. Calls to the user's external Railway server can continue during the Manus service window, while editing, rebuilding or republishing from an affected Manus project may be unavailable.[3]

No switch to a Manus production backend is required or allowed for RecoFree. Railway remains the only production backend.

## Restoration after August 25

Type A/B users restore Task Data after login. Type C users restore Account Info first, log in, and then restore Task Data. Restoration can be completed only once, so all correct complete packages must be selected together. Third-party connectors must be re-enabled manually after restoration.[4]

After restoration, verify the project checkpoint, code, secrets, Expo/EAS configuration, GitHub remote and Railway URL before creating a new APK.

## Local backup verification

Run:

```bash
bash scripts/create-local-backup.sh
cd backups/recofree-<timestamp>
sha256sum -c SHA256SUMS.txt
git bundle verify recofree-complete-history.bundle
```

The local backup is complementary to—not a replacement for—the official Manus Task Data Backup.

## References

[1]: https://help.manus.im/en/articles/16147831-service-change-overview-what-s-happening-and-am-i-affected "What’s Happening and Am I Affected?"
[2]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "How to Back Up Your Data"
[3]: https://help.manus.im/en/collections/19704025-data-back-up-and-restoration "Data Back Up and Restoration"
[4]: https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data "How to Restore Your Data"
