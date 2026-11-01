# Calendars

Local tasks, tracking, and Plan work with no calendar account. Google Calendar, Microsoft 365, and CalDAV are optional. Sign-in stays on this device. Tokens are not copied to another device by sync.

Two Google accounts and one Microsoft 365 account are supported. CalDAV accounts, including iCloud, are separate.

## Google

Google sign-in uses Super Productivity's bundled calendar plugin and its published desktop client. Calm Work enables that plugin, keeps one slot per account, and uses the plugin token only in memory for its own calendar commands.

Create a calendar named exactly **Calm Work** in the Google account you sign in with. Time blocks go there. The app cannot create that calendar. Tick the calendars to show. A calendar found later starts unticked. The Calm Work calendar stays on.

If a work domain blocks the app, an admin allows Super Productivity under the directory's app access control.

## Microsoft 365

Register a public client in your own Entra directory.

- Redirect `http://localhost/oauth/callback`.
- Delegated Graph permissions `Calendars.ReadWrite` and `offline_access`. Grant admin consent if the directory requires it.
- No client secret. Paste the Application (client) ID in Settings, Calendars, Microsoft 365.
- The tenant field starts as `contoso.onmicrosoft.com`. That name is Microsoft's documentation example. Replace it with your tenant id or domain, then sign in.

Consent returns to a random loopback port, with S256 PKCE, a three-minute timeout, and a strict state check. The authority is `login.microsoftonline.com/<tenant>`.

## CalDAV

Settings asks for a name, the server (the iCloud default is `https://caldav.icloud.com`), the email, and an app-specific password. The password stays in the plugin config. One occurrence of a repeating CalDAV event cannot be changed on its own. Choosing the series updates the master.

## What is stored where

Microsoft tokens, the Outlook event cache, calendar choices, and time-block records are encrypted together in the application profile with Electron safeStorage. Linux refuses the plain-text password store. The launcher passes `--password-store=gnome-libsecret` for that reason. If the OS credential store is locked, connect fails in the open.

No bearer token enters task storage, export, sync, the renderer, or logs.

## Time blocks

A task with a date and a time can become an event on a calendar the account can edit. The target is the task's calendar, or the default under Settings, Calendars, Time blocks.

Writes happen in the main process. Pending changes survive restart.

- The app marks the events it creates. Before a change it reads the provider event. No marker means the event is not ours, and it is never touched.
- If someone else edited or deleted the event, their version is kept. The block shows a conflict and the task can take the calendar time or write over the calendar.
- A retried create does not make a second event.
- Moving to another calendar deletes the old app event, then creates a new one.
- Transient failures retry with backoff. Permanent failures show on the task.

## Editing provider events

Events on ticked calendars you can edit can be created, opened, dragged, resized, and deleted after confirmation. The editor compares its version with a fresh read. A difference returns the newer version and writes nothing. Updates send the provider etag.

A repeating Google or Microsoft event asks whether a change applies to this occurrence or the series. A series time change moves the master by the same amount. Title, description, and location can apply to the series. Some series time or calendar changes are refused with a message rather than a partial write.

Read-only and unticked calendars refuse writes in the engine, not only in the screen.

Free or transparent events stay visible. They do not count as overlaps or as the next commitment. Calendars that only expose free or busy are skipped.

Events this app created are hidden from the read-only event list so a block does not appear twice.

## Checks

These use fake providers and synthetic data:

```sh
node --test scripts/verify-calendar-oauth.cjs scripts/verify-calendar-mirror.cjs
```

A live write belongs on a calendar you created for that test. macOS and Windows keychains, and phone OAuth, are not covered.
