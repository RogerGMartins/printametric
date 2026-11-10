// Full-window preview and one native drawer. Shell/tool data arrive through props.
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { WorkspaceDisplay } from './WorkspaceDisplay';
import type { WorkspaceDisplayProps } from './WorkspaceDisplay';
import type { WorkspaceContent } from './types';

interface WorkspaceProps extends WorkspaceDisplayProps {
  readonly content: WorkspaceContent;
  readonly title: string;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly notices: ReactNode;
  readonly availability: string;
  readonly preview?: ReactNode;
  readonly previewStatus?: string;
  readonly controls?: ReactNode;
  readonly summaries?: Readonly<Record<string, string>>;
}

export function Workspace({ content, title, headingRef, notices, availability, preview, previewStatus, controls, summaries, ...display }: WorkspaceProps) {
  const { preferences, errors, onChange } = display;
  const [primarySection, ...secondarySections] = content.unavailableSections;
  const tips = useRef<HTMLInputElement>(null);
  const background = useRef<HTMLFieldSetElement>(null);
  const pendingFocus = useRef<'tips' | 'background' | null>(null);
  useLayoutEffect(() => {
    if (!preferences.settingsOpen || !pendingFocus.current) return;
    if (pendingFocus.current === 'tips') tips.current?.focus();
    else background.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    pendingFocus.current = null;
  });
  function review(field: 'tips' | 'background') {
    pendingFocus.current = field;
    onChange('settingsOpen', true);
  }
  return <div className="workspace">
    <section className={`workspace-preview${preferences.previewBackground === 'grid' ? ' preview-grid' : ''}`} aria-label="Preview">
      <header className="preview-heading"><h1 ref={headingRef} tabIndex={-1}>{title}</h1><span>{previewStatus ?? 'Preview · No generated model'}</span></header>
      <div className="preview-stage">{preview ?? <div className="empty-preview"><h2>{content.heading}</h2><p>{content.description}</p></div>}</div>
      {preferences.previewBackground === 'grid' && <p className="grid-caption">Decorative grid — not to scale.</p>}
    </section>
    <div className="workspace-notices" role="status">
      {notices}
      {errors.settingsOpen && <section className="notice field-error"><h2>Error</h2><p id="settings-error">{errors.settingsOpen}</p></section>}
      {errors.showWorkspaceTips && <section className="notice field-error"><h2>Error</h2><p id="tips-error">{errors.showWorkspaceTips}</p>
        <button type="button" onClick={() => review('tips')}>Review Show workspace tips</button></section>}
      {errors.previewBackground && <section className="notice field-error"><h2>Error</h2><p id="background-error">{errors.previewBackground}</p>
        <button type="button" onClick={() => review('background')}>Review Preview background</button></section>}
    </div>
    <details className="settings-drawer" open={preferences.settingsOpen} onToggle={event => {
      if (event.currentTarget.open !== preferences.settingsOpen) onChange('settingsOpen', event.currentTarget.open);
    }}>
      <summary aria-invalid={Boolean(errors.settingsOpen)} aria-describedby={errors.settingsOpen ? 'settings-error' : undefined}
        onClick={event=>{
          // Native toggle arrives in a later task. Commit pointer/keyboard
          // activation now so an immediate recovery action sees the closed state.
          event.preventDefault();onChange('settingsOpen',!preferences.settingsOpen);
        }}>Workspace settings</summary>
      <div className="settings-content">
        {controls}
        <WorkspaceDisplay {...display} tipsRef={tips} backgroundRef={background} availability={availability} />
        <section className="settings-group" aria-label="Model availability">
          {!controls && primarySection && <div><h2>{primarySection.heading}</h2><p>{primarySection.description}</p></div>}
          <dl className="workspace-summaries">{['Dimensions', 'Parts', 'Plates'].map(label => <div key={label}><dt>{label}</dt><dd>{summaries?.[label] ?? 'Not available'}</dd></div>)}</dl>
        </section>
        {secondarySections.map(section => <section className="settings-group" key={section.heading}><h2>{section.heading}</h2><p>{section.description}</p></section>)}
      </div>
    </details>
  </div>;
}
