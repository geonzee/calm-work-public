import { TestBed } from "@angular/core/testing";
import { Subject, of } from "rxjs";
import { TakeABreakService } from "../take-a-break/take-a-break.service";
import { TaskService } from "../tasks/task.service";
import { GlobalTrackingIntervalService } from "../../core/global-tracking-interval/global-tracking-interval.service";
import { IdleService } from "../idle/idle.service";
import { GlobalConfigService } from "../config/global-config.service";
import { NotifyService } from "../../core/notify/notify.service";
import { BannerService } from "../../core/banner/banner.service";
import { UiHelperService } from "../ui-helper/ui-helper.service";
import { SnackService } from "../../core/snack/snack.service";
import { LOCAL_ACTIONS } from "../../util/local-actions.token";

describe("Calm host attention boundary", () => {
  const previous = document.documentElement.dataset.calmHost;
  afterEach(() => {
    if (previous === undefined)
      delete document.documentElement.dataset.calmHost;
    else document.documentElement.dataset.calmHost = previous;
  });
  it("does not subscribe SP break prompts or sounds even with breaks enabled", () => {
    document.documentElement.dataset.calmHost = "true";
    const ticks = new Subject(),
      sounds = new Subject(),
      actions = new Subject();
    const notify = jasmine.createSpy("notifyDesktop"),
      banner = jasmine.createSpy("open");
    TestBed.configureTestingModule({
      providers: [
        TakeABreakService,
        {
          provide: TaskService,
          useValue: { currentTaskId$: of("task"), currentTaskId: () => "task" },
        },
        { provide: GlobalTrackingIntervalService, useValue: { tick$: ticks } },
        { provide: IdleService, useValue: { isIdle$: of(false) } },
        {
          provide: GlobalConfigService,
          useValue: {
            cfg$: of({ takeABreak: { isTakeABreakEnabled: true } }),
            sound$: sounds,
          },
        },
        { provide: NotifyService, useValue: { notifyDesktop: notify } },
        { provide: BannerService, useValue: { open: banner } },
        { provide: UiHelperService, useValue: {} },
        { provide: SnackService, useValue: {} },
        { provide: LOCAL_ACTIONS, useValue: actions },
      ],
    });
    TestBed.inject(TakeABreakService);
    ticks.next({ duration: 8 * 60 * 60 * 1000 });
    sounds.next({ breakReminderSound: "sound" });
    expect(notify).not.toHaveBeenCalled();
    expect(banner).not.toHaveBeenCalled();
    expect(ticks.observed).toBeFalse();
    expect(sounds.observed).toBeFalse();
  });
});
