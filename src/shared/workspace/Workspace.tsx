// Shared workspace composition: preview first in DOM, controls first on wide screens.
import { WorkspaceDisplay } from './WorkspaceDisplay';
import type { WorkspaceDisplayProps } from './WorkspaceDisplay';
import type { WorkspaceContent } from './types';

interface WorkspaceProps extends WorkspaceDisplayProps {
  readonly content: WorkspaceContent;
}

export function Workspace({ content, ...display }: WorkspaceProps) {
  const grid = display.preferences.previewBackground === 'grid';
  return (
    <div className="workspace-layout">
      <section className="workspace-preview" aria-labelledby="preview-heading">
        <h2 id="preview-heading">Preview</h2>
        <div className={`preview-surface${grid ? ' preview-grid' : ''}`}>
          <div className="empty-preview">
            <h3>{content.heading}</h3>
            <p>{content.description}</p>
          </div>
        </div>
        {grid && <p className="grid-caption">Decorative grid — not to scale.</p>}
        <dl className="workspace-summaries">
          {['Dimensions', 'Parts', 'Plates'].map(label => <div key={label}>
            <dt>{label}</dt><dd>Not available</dd>
          </div>)}
        </dl>
      </section>
      <div className="workspace-controls">
        <WorkspaceDisplay {...display} />
        {content.unavailableSections.map(section => <section className="unavailable-section" key={section.heading}>
          <h2>{section.heading}</h2><p>{section.description}</p>
        </section>)}
      </div>
    </div>
  );
}
