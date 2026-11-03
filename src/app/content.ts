// Shell copy and navigation identity; tool-specific explanations live with the tool.
import type { View } from './state.ts';

export const WORKSPACE_VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'print-layout', label: 'Print layout' },
  { id: 'assembly', label: 'Assembly' },
];
export const FOUNDATION_AVAILABILITY = 'This view is not available yet. Use Design for blade patterns, local JSON designs, and assembled model exports.';

// Help describes the single application workspace and its real storage behavior.
export const HELP_SECTIONS = [
  { heading: 'Workspace views', text: 'Design, Print layout, and Assembly are views of the wall-art workspace. They are not required steps. Use the view links or your browser’s Back and Forward buttons to move between them.' },
  { heading: 'Display settings', text: 'Open Workspace settings at the bottom to change tips and the Plain or Grid preview background. The grid is decorative, not to scale. These settings and the open panel survive view changes and reset on reload.' },
  { heading: 'Keyboard', text: 'Use Tab and Shift+Tab to move between controls. Skip to workspace moves focus to the main content. Enter activates links and disclosures; native arrow keys change radio choices. In this dialog, Tab stays inside. Escape or the Close button returns focus to the opener. Browser navigation closes the dialog and focuses the new view heading.' },
  { heading: 'Theme storage', text: 'The sun/moon button switches to the opposite theme. System follows your operating system until you choose an override; Use system restores that behavior. Only the theme preference is remembered in this browser; no design is saved. If storage fails, the selected theme still applies for this visit. Use Retry theme storage to try again.' },
  { heading: 'Blade pattern', text: 'Open Workspace settings in Design to edit dimensions in millimeters. Enter or leave a numeric field to update. Invalid input retains the last valid model and disables export. Use Revert to accepted design to discard edits. The seed is saved but has no visible effect in this first pattern.' },
  { heading: 'Design files and exports', text: 'Save design JSON downloads editable parameters; Load design JSON validates before replacing your model. Export STEP, STL, or 3MF prepares only the selected format from the accepted design. Files contain separate parts in assembly positions, not packed build plates. STL uses millimeters. Save your design before reloading; designs are not stored automatically.' },
  { heading: 'Not available yet', text: 'Preset catalogues, plate configuration, part arrangement, mounting, and assembly guidance are not available yet.' },
] as const;

export const ABOUT_PARAGRAPHS = [
  'Printametric is a personal-use source-available project, not open source.',
  'The license permits individual natural persons to use the software for their own personal, private, noncommercial use, including private self-hosting.',
  'Organizational use, public hosting, commercial use, and selling generated models require separate written permission. The owner retains commercial-hosting rights.',
  'This is a summary. The unchanged LICENSE below is authoritative.',
] as const;
