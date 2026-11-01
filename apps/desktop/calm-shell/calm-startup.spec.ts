import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ExampleTasksService } from '../../core/example-tasks/example-tasks.service';
import { TaskService } from '../tasks/task.service';
import { SyncTriggerService } from '../../imex/sync/sync-trigger.service';

describe('Calm startup', () => {
  it('leaves an empty dedicated workspace free of upstream tutorial tasks', () => {
    const previous = document.documentElement.dataset.calmHost;
    document.documentElement.dataset.calmHost = 'true';
    const create = jasmine.createSpy('createNewTaskWithDefaults');
    try {
      TestBed.configureTestingModule({
        providers: [
          ExampleTasksService,
          provideMockStore(),
          { provide: TaskService, useValue: { createNewTaskWithDefaults: create } },
          {
            provide: SyncTriggerService,
            useValue: { afterInitialSyncDoneStrict$: of(true) },
          },
          {
            provide: TranslateService,
            useValue: { get: () => of({}), instant: (key: string) => key },
          },
        ],
      });
      const dispatch = spyOn(TestBed.inject(MockStore), 'dispatch');
      TestBed.inject(ExampleTasksService);
      expect(create).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete document.documentElement.dataset.calmHost;
      else document.documentElement.dataset.calmHost = previous;
    }
  });
});
