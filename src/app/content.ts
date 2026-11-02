// Shell copy and navigation identity; tool-specific explanations live with the tool.
import type { View } from './state.ts';

export const WORKSPACE_VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'print-layout', label: 'Print layout' },
  { id: 'assembly', label: 'Assembly' },
];
export const FOUNDATION_AVAILABILITY = 'Foundation workspace — no printable design, design saving, or downloads.';

// Help describes the single application workspace and its real storage behavior.
export const HELP_SECTIONS = [
  { heading: 'Workspace views', text: 'Design, Print layout, and Assembly are views of the wall-art workspace. They are not required steps. Use the view links or your browser’s Back and Forward buttons to move between them.' },
  { heading: 'Display settings', text: 'Open Workspace settings at the bottom to change tips and the Plain or Grid preview background. The grid is decorative, not to scale. These settings and the open panel survive view changes and reset on reload.' },
  { heading: 'Keyboard', text: 'Use Tab and Shift+Tab to move between controls. Skip to workspace moves focus to the main content. Enter activates links and disclosures; native arrow keys change radio choices. In this dialog, Tab stays inside. Escape or the Close button returns focus to the opener. Browser navigation closes the dialog and focuses the new view heading.' },
  { heading: 'Theme storage', text: 'The sun/moon button switches to the opposite theme. System follows your operating system until you choose an override; Use system restores that behavior. Only the theme preference is remembered in this browser; no design is saved. If storage fails, the selected theme still applies for this visit. Use Retry theme storage to try again.' },
  { heading: 'Not available yet', text: 'Model generation, editing, presets, design save/load, plate configuration, part arrangement, assembly guidance, and downloads are not available yet. Planned model formats: STEP, STL, and standard 3MF.' },
] as const;

export const ABOUT_PARAGRAPHS = [
  'Printametric is a personal-use source-available project, not open source.',
  'The license permits individual natural persons to use the software for their own personal, private, noncommercial use, including private self-hosting.',
  'Organizational use, public hosting, commercial use, and selling generated models require separate written permission. The owner retains commercial-hosting rights.',
  'This is a summary. The unchanged LICENSE below is authoritative.',
] as const;
