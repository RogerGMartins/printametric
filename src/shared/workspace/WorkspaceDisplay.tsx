// Controlled native display fields; the parent workspace owns disclosure and recovery.
import type { RefObject } from 'react';
import type { DisplayErrors, DisplayField, WorkspaceDisplayPreferences } from './types';

export interface WorkspaceDisplayProps {
  readonly preferences: WorkspaceDisplayPreferences;
  readonly errors: DisplayErrors;
  readonly onChange: (field: DisplayField, value: unknown) => void;
}

interface DisplayFieldsProps extends WorkspaceDisplayProps {
  readonly tipsRef: RefObject<HTMLInputElement | null>;
  readonly backgroundRef: RefObject<HTMLFieldSetElement | null>;
  readonly availability: string;
}

export function WorkspaceDisplay({ preferences, errors, onChange, tipsRef, backgroundRef, availability }: DisplayFieldsProps) {
  return <>
    <section className="settings-group" aria-labelledby="display-heading">
      <h2 id="display-heading">Display settings</h2>
      <label className="choice-row"><input ref={tipsRef} type="checkbox" checked={preferences.showWorkspaceTips}
        aria-invalid={Boolean(errors.showWorkspaceTips)} aria-describedby={errors.showWorkspaceTips ? 'tips-error' : undefined}
        onChange={event => onChange('showWorkspaceTips', event.currentTarget.checked)} />Show workspace tips</label>
      {preferences.showWorkspaceTips && <p className="workspace-tip">Change the display here. Open Help for workspace guidance.</p>}
      <p className="availability-note">{availability}</p>
    </section>
    <section className="settings-group" aria-labelledby="background-heading">
      <h2 id="background-heading">Preview background — {preferences.previewBackground === 'plain' ? 'Plain' : 'Grid'}</h2>
      <fieldset ref={backgroundRef} aria-describedby="background-description">
        <legend>Preview background</legend><p id="background-description">Changes the display only.</p>
        <div className="background-choices">{(['plain', 'grid'] as const).map(background => <label className="choice-row" key={background}>
          <input type="radio" name="preview-background" value={background} checked={preferences.previewBackground === background}
            aria-invalid={Boolean(errors.previewBackground)}
            aria-describedby={`background-description${errors.previewBackground ? ' background-error' : ''}`}
            onChange={event => onChange('previewBackground', event.currentTarget.value)} />{background === 'plain' ? 'Plain' : 'Grid'}
        </label>)}</div>
      </fieldset>
    </section>
  </>;
}
