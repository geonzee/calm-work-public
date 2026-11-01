# Design

The current screen is `apps/desktop/ui/keyboard-review.html` and the scripts next to it. Desktop and phone load that same renderer. Sample tasks in the file are synthetic fixtures for the standalone page. In the app, `runtime-controller.js` replaces them with saved records.

Visual direction: near-black surfaces, restrained orange, a compact header, and one sidebar for the thing you are editing. Keyboard and mouse both work. Touch uses visible controls, not hover.

References are inspiration only. Do not copy their code or assets. Open Sunsama for a calm dark layout and drag and drop. Super Productivity for capture, lists, and tracking. Morgen for the calendar. The booking and poll flows are original.

## Capture

One global plus. Top right on desktop, bottom right on the phone. It opens a compact bar: project, planned date and time, estimate, and repeat. Typed tokens such as `@today` and `t25m` offer a suggestion. Tab accepts it. Dismissing the bar keeps the draft. Creating the task clears it.

An unassigned task goes to Clean.

## Clean

Clean is the first item in the menu. The button label is Clean. It lists unfinished tasks with no project and shows their count. Edit project, date, or estimate inline. Assigning a project removes the task from Clean. Capture stays on the global plus.

## Track

Track is today's queue. There is no separate Today destination. Planned tasks come first, earliest first, then tasks with no time. The Today label is also the filter. Later and Completed start collapsed.

On desktop, a session starts here, by hover Play or keyboard. Plan and Projects do not start tracking. The phone task details have a Start tracking button.

The active task, its clock, and Pause or Resume stay in the header on every private view. Nothing shows there when nothing is running. Starting another task ends the current session without completing the previous task. Finish records the session and leaves the active queue.

One quiet line shows the next real task or event, and the time until it. If nothing is coming up, that line is absent.

## Plan

Plan is for arranging work. It opens on seven consecutive days, today first and a little wider. Drag the date headings or scroll sideways for later dates. Today returns to the left edge.

A collapsible list shows tasks that still need a place, grouped by project. Placed tasks leave that list. Unfinished tasks whose block has ended come back under Needs replanning. Events stay on the calendar.

Drag a task onto the grid, or use the keyboard: select the task, Right to reach the grid, arrows move by 30 minutes and by day, Enter places it. An empty slot can create a task or an event. Event details hold calendar, time, meeting link, and notes. Invitations are not sent.

Overlaps are visible and stay readable. Adjacent blocks are not overlaps. A live session appears at its real start and is not dragged. Recorded blocks are edited in Reports.

On a phone-width screen the Plan task list starts hidden. The calendar is the view.

iPhone and iPad hide Plan. The check is the iOS user agent, including an iPad that reports a desktop platform with touch. Saved Plan routes fall back to Track. Desktop and Android keep Plan.

## Projects and Reports

Project rows can be completed and opened. They do not start tracking. The board columns come from planned date and completion. Cards can be dragged.

Reports has Overview and Time entries. Filter by task, project, and date. Edit a time entry's project, date, and start or end. Duration follows the edit. Overview compares recorded totals with estimates. Exact focused seconds are kept.

## Phone

The phone bar is Add plus a menu: Track, Clean, Plan, Projects, Reports, Settings. Plan is missing from that menu on iPhone and iPad, as above.

A Track row opens its details on tap. Swipe starts tracking or moves the task to today. Text follows the system text size. The launch screen is dark.

The staged phone page does not link a web app manifest and does not ask for a translucent status bar. iOS 26 otherwise draws a Home Screen app short of the bottom. Browsers that need a manifest to offer install, such as Chrome on Android, do not get one from that staged page.

## Settings and guest pages

Booking, polls, and team stay out of the sidebar until Settings turns them on. Guest pages for a booking or a poll do not show the private app navigation.

## Out of the core screen

Deadline, reminder, subtasks, tags, and file attachments are not part of the current task details. Do not add them as if they were already agreed.
