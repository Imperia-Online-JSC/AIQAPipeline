import { execSync } from 'node:child_process';

// "Fullscreen" for a headless run means the render viewport — there is no visible window — so we
// size it to the host's MAIN display in CSS points (what a browser actually sees), detected fresh
// each run so it mirrors whatever machine/monitor the run happens on. Headed runs don't rely on
// this: tests/_shared/fixtures.ts reads the real screen at test-runtime and resizes the actual
// window (which also handles a window that maximized onto a different monitor than the main one).
//
// Falls back to Full HD when the platform can't be probed (non-macOS, sandboxed, parse failure),
// so a run never ends up at Chromium's tiny 800x600 headless default.
const FALLBACK = { width: 1920, height: 1080 };

let cached: { width: number; height: number } | undefined;

export function getScreenSize(): { width: number; height: number } {
  if (!cached) cached = detect() ?? FALLBACK;
  return cached;
}

function detect(): { width: number; height: number } | undefined {
  if (process.platform !== 'darwin') return undefined;
  try {
    const out = execSync('system_profiler SPDisplaysDataType', {
      encoding: 'utf8',
      timeout: 5000,
    });

    // system_profiler prints one block per display. Split so each block runs from its own
    // "Resolution:" line up to the next display's, then prefer the one flagged as the main display.
    const blocks = out.split(/^\s*Resolution:/m).slice(1);
    const mainRaw = blocks.find((b) => /Main Display:\s*Yes/i.test(b)) ?? blocks[0];
    if (!mainRaw) return undefined;
    const block = 'Resolution:' + mainRaw;

    // Effective CSS points: prefer the "UI Looks like: W x H" line (the scaled resolution a Retina
    // display actually renders at), else derive from the physical resolution — halved when the
    // panel is Retina (2x), as-is otherwise.
    const looksLike = block.match(/UI Looks like:\s*(\d+)\s*x\s*(\d+)/i);
    if (looksLike) return { width: +looksLike[1], height: +looksLike[2] };

    const res = block.match(/Resolution:\s*(\d+)\s*x\s*(\d+)(\s*Retina)?/i);
    if (res) {
      const scale = res[3] ? 2 : 1;
      return { width: Math.round(+res[1] / scale), height: Math.round(+res[2] / scale) };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
