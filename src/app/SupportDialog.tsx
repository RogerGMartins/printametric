// Own native modal behavior and focus. App owns the accepted support-panel state.
import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import license from '../../LICENSE?raw';
import { ABOUT_PARAGRAPHS, HELP_SECTIONS } from './content';
import type { SupportPanel } from './state';

type SupportDialogProps = {
  readonly panel: Exclude<SupportPanel, 'none'>;
  readonly opener: RefObject<HTMLButtonElement | null>;
  readonly onDismiss: () => void;
};

export function SupportDialog({ panel, opener, onDismiss }: SupportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = panel === 'help' ? 'Help' : 'About';

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    heading.current?.focus();
    return () => {
      // Close before App's navigation layout effect focuses the new view heading.
      // This also balances StrictMode's setup/cleanup and clears native inertness.
      element.close();
      opener.current?.focus({ preventScroll: true });
    };
  }, [panel, opener]);

  function keepTabInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    // These are the dialog's only tab stops. Explicit wrapping also prevents Tab
    // from leaving the document for browser chrome at the native modal boundary.
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, summary');
    const first = controls[0];
    const last = controls[controls.length - 1];
    const atStart = document.activeElement === first || document.activeElement === heading.current
      || document.activeElement === event.currentTarget; // Backdrop clicks focus the dialog itself.
    if (event.shiftKey && atStart) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return <dialog ref={dialog} className="support-dialog" aria-labelledby="support-title"
    onKeyDown={keepTabInside} onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <div className="support-dialog-header">
      <h2 id="support-title" ref={heading} tabIndex={-1}>{title}</h2>
      <button type="button" onClick={onDismiss}>Close {title}</button>
    </div>
    {panel === 'help'
      ? HELP_SECTIONS.map(section => <section key={section.heading} className="support-section">
        <h3>{section.heading}</h3><p>{section.text}</p>
      </section>)
      : <div className="support-about">
        {ABOUT_PARAGRAPHS.map(text => <p key={text}>{text}</p>)}
        <details><summary>Read full license</summary><pre className="license-text">{license}</pre></details>
      </div>}
  </dialog>;
}
