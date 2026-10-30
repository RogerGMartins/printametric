// Wall-art copy only. The shell selects content; shared UI does not know tool routes.
import type { WorkspaceContent } from '../../shared/workspace/types.ts';

const wallArtSettings = {
  heading: 'Wall-art settings', description: 'Model editing and presets are not available yet.',
};
const buildPlateSettings = {
  heading: 'Build-plate settings', description: 'Plate configuration is not available yet.',
};

export const WALL_ART_CONTENT = {
  design: {
    heading: 'No model yet', description: 'Model generation is not available in this version.',
    unavailableSections: [wallArtSettings, buildPlateSettings],
  },
  'print-layout': {
    heading: 'No print layout yet', description: 'Part arrangement and fit checks are not available in this version.',
    unavailableSections: [buildPlateSettings],
  },
  assembly: {
    heading: 'No assembly guidance yet', description: 'Assembly guidance is not available in this version.',
    unavailableSections: [],
  },
} satisfies Record<string, WorkspaceContent>;
