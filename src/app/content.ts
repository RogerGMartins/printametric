// Shell copy and navigation identity; tool-specific explanations live with the tool.
import type { View } from './state.ts';

export const WORKSPACE_VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'print-layout', label: 'Print layout' },
  { id: 'assembly', label: 'Assembly' },
];
export const FOUNDATION_FOOTER = 'Foundation workspace — no printable design, design saving, or downloads.';
