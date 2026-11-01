import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { ProjectEffects } from '../project/store/project.effects';
import { addProject, updateProject } from '../project/store/project.actions';
import { DEFAULT_PROJECT } from '../project/project.const';
import { LOCAL_ACTIONS } from '../../util/local-actions.token';
import { SnackService } from '../../core/snack/snack.service';
import { GlobalConfigService } from '../config/global-config.service';
import { LocalDraftService } from '../../core/draft/local-draft.service';

describe('Calm project feedback ownership', () => {
  for (const route of ['/calm', '/project/test']) {
    it(`keeps project feedback with the current view at ${route}`, () => {
      const actions = new Subject<
        ReturnType<typeof addProject> | ReturnType<typeof updateProject>
      >();
      const open = jasmine.createSpy('open');
      TestBed.configureTestingModule({
        providers: [
          ProjectEffects,
          { provide: LOCAL_ACTIONS, useValue: actions },
          { provide: Router, useValue: { url: route } },
          { provide: SnackService, useValue: { open } },
          { provide: GlobalConfigService, useValue: {} },
          { provide: LocalDraftService, useValue: {} },
        ],
      });
      const effects = TestBed.inject(ProjectEffects);
      const created = effects.onProjectCreatedSnack.subscribe();
      const updated = effects.snackUpdateBaseSettings$.subscribe();
      actions.next(
        addProject({
          project: { ...DEFAULT_PROJECT, id: 'test', title: 'Test project' },
        }),
      );
      actions.next(
        updateProject({ project: { id: 'test', changes: { title: 'Renamed' } } }),
      );
      expect(open).toHaveBeenCalledTimes(route === '/calm' ? 0 : 2);
      created.unsubscribe();
      updated.unsubscribe();
    });
  }
});
