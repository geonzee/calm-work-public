# Limits

These are the current boundaries. A contribution can close one. It should not pretend one is already done.

## Not built

- Web Push. The phone syncs when the app returns to the foreground. iOS shows a notification for every push, so silent background sync is not available in the web app.
- A native iOS or Android app. The phone client is the web build.
- Windows and macOS installers. The packaged desktop app is exercised on Linux.
- Signup mail for a self-hosted SuperSync server. The Compose example leaves SMTP empty.
- A public deployment of booking, polls, or shared projects. `services/online` is a local service.

## On purpose

- Plan is hidden on iPhone and iPad. Desktop and Android keep it.
- The staged phone page does not link a web app manifest, so iOS 26 can fill the screen. Android install prompts that depend on a manifest are not offered.
- Booking, polls, and team stay hidden until Settings turns them on.
- Estimates are never displayed as recorded time.
- The app does not create the Google calendar named Calm Work. You create that calendar in Google.

## Known gaps

- `scripts/verify-reviewed-ui.cjs` still has a 25 pixel difference on the `390-booking-questions` state.
- Automated calendar checks use fake providers. They do not sign in to a live Google or Microsoft account.
- A physical phone is not part of the automated checks. `scripts/verify-ios-pwa.cjs` drives WebKit locally.
- Provider push for calendar changes is not built. Google follows the upstream poll. Microsoft refreshes on a five-minute interval, and a manual refresh is available.
- Edge resizing of a planned task block is not a separate gesture beyond the event resize handles that already exist.

## Hosting

This repository does not know a live site or a live sync server. Do not add an account id, a token, or a hostname to close that gap. Each person runs their own.
