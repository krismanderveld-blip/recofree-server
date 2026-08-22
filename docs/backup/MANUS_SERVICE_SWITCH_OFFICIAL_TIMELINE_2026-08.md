# Manus Service Switch — Official Mobile App Timeline

**Source of truth for affected status:** the user's in-app notice and email.

| Event | Official time |
|---|---|
| Backup deadline | August 23, 2026 at 7:59 a.m. Singapore Time |
| Service-unavailable period | August 23 at 8:00 a.m. through August 25 at 7:59 a.m. Singapore Time |
| Restoration opens | August 25, 2026 at 8:00 a.m. Singapore Time |

For a Manus-built mobile App, a Task Data Backup preserves project source code, checkpoints, repository history, current project instructions, Manus-hosted backend/configuration, secrets/environment variables, integrations, and supporting Expo/EAS build configuration. Each export is a fixed point-in-time snapshot and does not synchronize later changes.

RecoFree uses Railway as its production GPT proxy backend. The installed APK and calls to Railway are external to the Manus-hosted backend and can continue, while project editing/building in an affected Manus workspace may be unavailable during the service window.

Before the deadline, create a Task Data Backup through **Export task data → Export more → All tasks → All time → Start export**. Keep every complete package unchanged and do not rename or mix split parts. Type C users must create the Account Info Backup before Task Data Backup; Type A/B users need Task Data Backup. Restoration is performed once, so all correct packages must be selected together.

## Official sources

- [Data Backup Tool](https://manus.im/backup)
- [What’s Happening and Am I Affected?](https://help.manus.im/en/articles/16147831-service-change-overview-what-s-happening-and-am-i-affected)
- [How to Back Up Your Data](https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data)
- [How to Restore Your Data](https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data)
- [Data Back Up and Restoration collection](https://help.manus.im/en/collections/19704025-data-back-up-and-restoration)
