// Tool-independent display contracts. These types contain no shell or browser state.
export type PreviewBackground = 'plain' | 'grid';

export interface WorkspaceDisplayPreferences {
  readonly showWorkspaceTips: boolean;
  readonly previewBackground: PreviewBackground;
  readonly advancedOpen: boolean;
}

export interface WorkspaceContent {
  readonly heading: string;
  readonly description: string;
}
