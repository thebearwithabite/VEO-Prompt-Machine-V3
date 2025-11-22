/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  ApiCallSummary,
  IMAGEN_COST_PER_IMAGE,
  GEMINI_FLASH_INPUT_COST_PER_MILLION_TOKENS,
  GEMINI_FLASH_OUTPUT_COST_PER_MILLION_TOKENS,
  GEMINI_PRO_INPUT_COST_PER_MILLION_TOKENS,
  GEMINI_PRO_OUTPUT_COST_PER_MILLION_TOKENS,
  Shot,
  ShotBook
} from '../types';

/**
 * Calculates the estimated total API cost based on the summary of calls and token usage.
 * Pricing is based on estimated costs per million tokens and per image.
 */
const calculateEstimatedCost = (summary: ApiCallSummary): number => {
  const proInputCost = (summary.proTokens.input / 1_000_000) * GEMINI_PRO_INPUT_COST_PER_MILLION_TOKENS;
  const proOutputCost = (summary.proTokens.output / 1_000_000) * GEMINI_PRO_OUTPUT_COST_PER_MILLION_TOKENS;
  const flashInputCost = (summary.flashTokens.input / 1_000_000) * GEMINI_FLASH_INPUT_COST_PER_MILLION_TOKENS;
  const flashOutputCost = (summary.flashTokens.output / 1_000_000) * GEMINI_FLASH_OUTPUT_COST_PER_MILLION_TOKENS;
  const imageCost = summary.image * IMAGEN_COST_PER_IMAGE;

  return proInputCost + proOutputCost + flashInputCost + flashOutputCost + imageCost;
};


/**
 * Transforms the application's ShotBook state into the JSON format
 * expected by the report's inline JavaScript.
 */
const transformShotBookForReport = (shotBook: ShotBook) => {
  const reportShots = shotBook.map((shot, index) => {
    // A fallback VEO shot object for when generation fails
    const fallbackVeoJson = {
      shot_id: shot.id,
      scene: {
        context: 'Generation Failed',
        visual_style: 'N/A',
        lighting: 'N/A',
        mood: 'N/A',
        aspect_ratio: '16:9',
        duration_s: 0,
      },
      character: {
        name: 'N/A',
        gender_age: 'N/A',
        description_lock: 'N/A',
        behavior: shot.pitch,
        expression: 'N/A',
      },
      camera: {
        shot_call: 'N/A',
        movement: 'N/A',
      },
      audio: {
        dialogue: '',
        delivery: '',
        ambience: '',
        sfx: '',
      },
      flags: {
        continuity_lock: false,
        do_not: [],
        anti_artifacts: [],
        conflicts: [],
        warnings: [],
        cv_updates: []
      },
    };

    const veoJson = shot.veoJson?.veo_shot || fallbackVeoJson;
    const directorNotes = shot.veoJson?.directorNotes || null;

    const audioSpecs = [
      veoJson.audio.dialogue ? 'dialogue' : null,
      veoJson.audio.ambience ? 'ambience' : null,
      veoJson.audio.sfx ? 'sound effects' : null,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      sequence_number: index + 1,
      shot_id: shot.id,
      target_api: 'veo3',
      duration_seconds: veoJson.scene.duration_s,
      keyframe_image_b64: shot.keyframeImage || null,
      veo3_json: veoJson,
      director_notes: directorNotes, // Include director_notes
      audio_specs: audioSpecs || 'no audio',
    };
  });

  return {shots: reportShots};
};

export const generateMasterShotlistHtml = (
  shotBook: ShotBook,
  projectName: string,
  apiCallSummary: ApiCallSummary,
  appVersion: string, // New parameter for app version
): string => {
  const reportData = transformShotBookForReport(shotBook);
  const totalDuration = reportData.shots.reduce(
    (sum, shot) => sum + shot.duration_seconds,
    0,
  );
  const shotCount = reportData.shots.length;
  const estimatedCost = calculateEstimatedCost(apiCallSummary);

  const apiSummaryHtml = `
    <p><strong>API Calls:</strong> Gemini 3 Pro: ${apiCallSummary.pro}, Flash: ${apiCallSummary.flash}, Gemini 3 Pro Image: ${apiCallSummary.image}</p>
    <p><strong>Tokens Used:</strong></p>
    <ul class="list-disc list-inside ml-4">
      <li>Gemini 3 Pro Preview: Input ${apiCallSummary.proTokens.input.toLocaleString()} | Output ${apiCallSummary.proTokens.output.toLocaleString()}</li>
      <li>Gemini 2.5 Flash: Input ${apiCallSummary.flashTokens.input.toLocaleString()} | Output ${apiCallSummary.flashTokens.output.toLocaleString()}</li>
    </ul>
    <p class="text-lg font-bold mt-2">Estimated Cost: <span class="text-green-600">$${estimatedCost.toFixed(4)}</span></p>
  `;

  const masterShotlistJson = JSON.stringify(reportData, null, 2);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Master Shot List: ${projectName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root {
            --color-primary-dark: #00424a;
            --color-primary-light: #edfcff;
            --color-secondary-dark: #273f43;
            --color-secondary-light: #dbf6fa;
            --color-tertiary-dark: #2f3b58;
            --color-tertiary-light: #bac6ea;
            --color-background: #cde7ec;
            --color-error: #de3730;
            --color-neutral-dark: #393c3d;
            --color-neutral-light: #f8fafa;
        }
        .bg-primary-dark { background-color: var(--color-primary-dark); }
        .text-primary-dark { color: var(--color-primary-dark); }
        .bg-primary-light { background-color: var(--color-primary-light); }
        .bg-secondary-dark { background-color: var(--color-secondary-dark); }
        .text-secondary-dark { color: var(--color-secondary-dark); }
        .bg-secondary-light { background-color: var(--color-secondary-light); }
        .bg-tertiary-dark { background-color: var(--color-tertiary-dark); }
        .text-tertiary-light { color: var(--color-tertiary-light); }
        .bg-background { background-color: var(--color-background); }
        .bg-error { background-color: var(--color-error); }
        .bg-neutral-dark { background-color: var(--color-neutral-dark); }
        .bg-neutral-light { background-color: var(--color-neutral-light); }
        .font-mono-custom { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; }
        @media print {
            body { background-color: #fff !important; color: #000 !important; }
            header, nav { display: none; }
            main { margin-left: 0 !important; width: 100% !important; }
            .shot-card { border: 1px solid #ccc !important; box-shadow: none !important; page-break-inside: avoid; margin-bottom: 1rem; }
            .shot-card-details { display: block !important; }
            .copy-prompt-btn, .toggle-details-btn { display: none; }
        }
        .quick-ref-panel { scrollbar-width: thin; scrollbar-color: var(--color-secondary-dark) var(--color-secondary-light); }
        .quick-ref-panel::-webkit-scrollbar { width: 8px; }
        .quick-ref-panel::-webkit-scrollbar-track { background: var(--color-secondary-light); }
        .quick-ref-panel::-webkit-scrollbar-thumb { background-color: var(--color-secondary-dark); border-radius: 4px; border: 2px solid var(--color-secondary-light); }
    </style>
</head>
<body class="bg-background text-neutral-dark min-h-screen flex flex-col font-sans">
    <header class="bg-primary-dark text-primary-light p-4 shadow-lg print:hidden">
        <div class="container mx-auto flex flex-col md:flex-row justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold">${projectName}</h1>
                <p class="text-sm text-secondary-light">Master Shot List (v${appVersion})</p>
            </div>
            <div class="text-sm text-right md:text-left mt-2 md:mt-0">
                <p>Number of Clips: <span id="shot-count" class="font-semibold">${shotCount}</span></p>
                <p>Total Duration: <span id="total-duration" class="font-semibold">${totalDuration}</span> seconds</p>
                <p>Generated: <span id="generation-time" class="font-semibold"></span></p>
                <div class="api-summary-details mt-2">
                    ${apiSummaryHtml}
                </div>
            </div>
        </div>
    </header>

    <div class="flex flex-1">
        <nav class="quick-ref-panel bg-secondary-light text-secondary-dark w-64 p-4 overflow-y-auto shadow-md hidden md:block print:hidden">
            <h2 class="text-xl font-semibold mb-4">Quick Reference</h2>
            <h3 class="text-lg font-medium mb-2">Shot IDs</h3>
            <ul id="shot-id-list" class="space-y-1 mb-4"></ul>
            <h3 class="text-lg font-medium mb-2">Continuity Checkpoints</h3>
            <ul id="continuity-list" class="space-y-1"></ul>
        </nav>

        <main class="flex-1 p-4 md:p-8">
            <section id="main-shot-list" class="max-w-4xl mx-auto space-y-6"></section>
        </main>
    </div>

    <script>
        const masterShotlist = ${masterShotlistJson};
        const shots = masterShotlist.shots;

        document.getElementById('generation-time').textContent = new Date().toLocaleString();

        const mainShotList = document.getElementById('main-shot-list');
        const shotIdList = document.getElementById('shot-id-list');
        const continuityList = document.getElementById('continuity-list');

        shots.forEach(shot => {
            const shotCard = document.createElement('div');
            shotCard.id = \`shot-\${shot.sequence_number}\`;
            shotCard.className = 'shot-card bg-primary-light p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200';

            const hasDialogue = shot.veo3_json.audio.dialogue && shot.veo3_json.audio.dialogue.trim() !== '';
            const isContinuityLocked = shot.veo3_json.flags.continuity_lock;
            const isExtendUnit = shot.veo3_json.unit_type === 'extend'; // Check for extend unit_type

            let promptText = \`\${shot.veo3_json.scene.context} \${shot.veo3_json.character.name !== 'N/A' ? shot.veo3_json.character.name + ': ' : ''}\${shot.veo3_json.character.behavior !== 'N/A' ? shot.veo3_json.character.behavior : ''} \${shot.veo3_json.camera.shot_call}.\`.replace(/\\s\\s+/g, ' ').trim();
            const veoJsonString = JSON.stringify(shot.veo3_json, null, 2);

            shotCard.innerHTML = \`
                <div class="flex flex-col md:flex-row gap-4">
                    <!-- Left Side: Image & Key Info -->
                    <div class="w-full md:w-1/3 flex-shrink-0">
                        <div class="aspect-video bg-neutral-dark rounded-md mb-3 flex items-center justify-center">
                            \${shot.keyframe_image_b64 ? \`<img src="data:image/png;base64,\${shot.keyframe_image_b64}" class="w-full h-full object-cover rounded-md">\` : '<span class="text-neutral-light text-sm">No Keyframe</span>'}
                        </div>
                         <h3 class="text-lg font-bold text-primary-dark">\${shot.sequence_number}. \${shot.shot_id}</h3>
                         <p class="text-sm text-secondary-dark">\${shot.duration_seconds} seconds</p>
                         \${isContinuityLocked ? '<p class="text-sm font-semibold text-tertiary-dark mt-1">✓ Continuity Locked</p>' : ''}
                         \${hasDialogue ? '<p class="text-sm font-semibold text-green-700 mt-1">💬 Dialogue Present</p>' : ''}
                    </div>

                    <!-- Right Side: Details -->
                    <div class="w-full md:w-2/3">
                        <div class="flex justify-between items-center mb-2">
                             <h4 class="text-md font-semibold text-secondary-dark">VEO 3.1 JSON Prompt</h4>
                             <button class="toggle-details-btn text-primary-dark hover:text-secondary-dark focus:outline-none">
                                <svg class="w-5 h-5 transform transition-transform duration-200 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                        </div>
                        <div class="shot-card-details space-y-2 text-sm">
                            \${shot.director_notes && isExtendUnit ? \`
                                <div class="bg-secondary-dark text-secondary-light p-3 rounded-md">
                                    <p class="font-semibold mb-1">Director's Notes (Extend Block):</p>
                                    <pre class="whitespace-pre-wrap font-mono-custom text-xs max-h-24 overflow-auto">\${shot.director_notes}</pre>
                                </div>
                            \` : ''}
                            <div class="bg-secondary-light p-3 rounded-md font-mono-custom text-neutral-dark relative">
                                <pre class="whitespace-pre-wrap max-h-60 overflow-auto">\${veoJsonString}</pre>
                                <button class="copy-prompt-btn absolute top-2 right-2 bg-tertiary-light text-tertiary-dark px-2 py-1 rounded-md text-xs hover:bg-tertiary-dark hover:text-tertiary-light transition-colors duration-200" title="Copy JSON">Copy</button>
                            </div>
                            \${hasDialogue ? \`
                                <p><strong class="text-secondary-dark">DIALOGUE:</strong></p>
                                <div class="bg-secondary-light p-3 rounded-md">
                                    <p><strong class="text-secondary-dark">Speaker:</strong> \${shot.veo3_json.character.name || 'N/A'}</p>
                                    <p><strong class="text-secondary-dark">Line:</strong> "\${shot.veo3_json.audio.dialogue}"</p>
                                    <p><strong class="text-secondary-dark">Delivery:</strong> \${shot.veo3_json.audio.delivery || 'N/A'}</p>
                                </div>
                            \` : ''}
                            <p><strong class="text-secondary-dark">AUDIO:</strong> \${shot.audio_specs || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            \`;
            mainShotList.appendChild(shotCard);

            const shotIdItem = document.createElement('li');
            shotIdItem.innerHTML = \`<a href="#shot-\${shot.sequence_number}" class="text-secondary-dark hover:text-primary-dark hover:underline">\${shot.shot_id}</a>\`;
            shotIdList.appendChild(shotIdItem);

            if (isContinuityLocked) {
                const continuityItem = document.createElement('li');
                continuityItem.innerHTML = \`<a href="#shot-\${shot.sequence_number}" class="text-secondary-dark hover:text-primary-dark hover:underline">\${shot.shot_id}</a>\`;
                continuityList.appendChild(continuityItem);
            }
        });

        mainShotList.addEventListener('click', (event) => {
            const toggleBtn = event.target.closest('.toggle-details-btn');
            if (toggleBtn) {
                const shotCard = toggleBtn.closest('.shot-card');
                const details = shotCard.querySelector('.shot-card-details');
                const icon = toggleBtn.querySelector('svg');
                details.classList.toggle('hidden');
                icon.classList.toggle('rotate-180');
            }

            const copyBtn = event.target.closest('.copy-prompt-btn');
            if (copyBtn) {
                const preElement = copyBtn.previousElementSibling;
                navigator.clipboard.writeText(preElement.textContent.trim()).then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
                });
            }
        });

        document.querySelectorAll('.quick-ref-panel a').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
            });
        });

        // Default all shot cards to expanded
        document.querySelectorAll('.shot-card-details').forEach(d => d.classList.remove('hidden'));
        document.querySelectorAll('.toggle-details-btn svg').forEach(s => s.classList.remove('rotate-180'));
    </script>
</body>
</html>
  `;
};