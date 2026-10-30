// Native display controls. Accepted values/errors come from the shell, not local copies.
import { useLayoutEffect, useRef } from 'react';
import type { DisplayErrors, DisplayField, WorkspaceDisplayPreferences } from './types';

export interface WorkspaceDisplayProps {
  readonly preferences: WorkspaceDisplayPreferences;
  readonly errors: DisplayErrors;
  readonly onChange: (field: DisplayField, value: unknown) => void;
}

export function WorkspaceDisplay({ preferences, errors, onChange }: WorkspaceDisplayProps) {
  const backgroundGroup = useRef<HTMLFieldSetElement>(null);
  const focusBackground = useRef(false);
  // Wait for the disclosure's DOM to open before moving keyboard focus inside it.
  useLayoutEffect(() => {
    if (focusBackground.current && preferences.advancedOpen) {
      focusBackground.current = false;
      backgroundGroup.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    }
  });

  return (
    <section className="workspace-display" aria-labelledby="display-heading">
      <h2 id="display-heading">Workspace display</h2>
      <label className="choice-row">
        <input type="checkbox" checked={preferences.showWorkspaceTips}
          aria-invalid={Boolean(errors.showWorkspaceTips)}
          aria-describedby={errors.showWorkspaceTips ? 'tips-error' : undefined}
          onChange={event => onChange('showWorkspaceTips', event.currentTarget.checked)} />
        Show workspace tips
      </label>
      <div role="status">
        {errors.showWorkspaceTips && <div className="field-error"><h3>Error</h3><p id="tips-error">{errors.showWorkspaceTips}</p></div>}
      </div>
      {preferences.showWorkspaceTips && <p className="workspace-tip">Change the display here. Open Help for workspace guidance.</p>}
      <details open={preferences.advancedOpen} onToggle={event => {
        // Programmatic open changes emit toggle too; do not treat those as new edits.
        if (event.currentTarget.open !== preferences.advancedOpen) onChange('advancedOpen', event.currentTarget.open);
      }}>
        <summary aria-invalid={Boolean(errors.advancedOpen)}
          aria-describedby={errors.advancedOpen ? 'advanced-error' : undefined}>
          Advanced — {preferences.previewBackground === 'plain' ? 'Plain' : 'Grid'} background
        </summary>
        <fieldset ref={backgroundGroup} aria-describedby="background-description">
          <legend>Preview background</legend>
          <p id="background-description">Changes the display only.</p>
          {(['plain', 'grid'] as const).map(background => (
            <label className="choice-row" key={background}>
              <input type="radio" name="preview-background" value={background}
                checked={preferences.previewBackground === background}
                aria-invalid={Boolean(errors.previewBackground)}
                aria-describedby={`background-description${errors.previewBackground ? ' background-error' : ''}`}
                onChange={event => onChange('previewBackground', event.currentTarget.value)} />
              {background === 'plain' ? 'Plain' : 'Grid'}
            </label>
          ))}
        </fieldset>
      </details>
      {/* Errors stay outside details so collapsing it cannot hide a failed update. */}
      <div role="status">
        {errors.advancedOpen && <div className="field-error"><h3>Error</h3><p id="advanced-error">{errors.advancedOpen}</p></div>}
        {errors.previewBackground && <div className="notice field-error">
          <h3>Error</h3>
          <p id="background-error">{errors.previewBackground}</p>
          {!preferences.advancedOpen && <button type="button" onClick={() => {
            focusBackground.current = true;
            onChange('advancedOpen', true);
          }}>Review Preview background</button>}
        </div>}
      </div>
    </section>
  );
}
