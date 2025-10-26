# VEO 3.1 Prompt Machine

An interactive Director's Assistant that transforms creative scripts into structured, production-ready VEO 3.1 JSON prompts, complete with keyframes, scene plans, and collaborative editing features.

## Core Features

*   **Script Ingestion:** Accepts creative input via direct text paste or file upload (.txt, .md, .rtf, .pdf).
*   **Ingredient Images:** Supports up to 3 global reference images (for characters, items, or environments) to guide generation.
*   **Automated Pre-Production Pipeline:**
    *   **Project Naming:** Intelligently generates a filesystem-safe project name from the script.
    *   **Shot Breakdown:** Automatically analyzes the script to produce a detailed shot list with unique IDs and descriptive pitches.
    *   **Scene Planning:** For each scene, it generates a strategic `ScenePlan` outlining narrative beats, runtime goals, and an `ExtendPolicy` to enable longer, chained shots.
    *   **VEO 3.1 JSON Generation:** Creates VEO-compliant JSON for each shot, dynamically choosing between single shots or chained sequences based on the scene plan. Includes `directorNotes` for 'extend' type shots, providing natural language guidance.
    *   **AI Keyframing:** Optionally generates a cinematic keyframe for every shot, incorporating specified ingredient images.
*   **Interactive Shot Book:**
    *   A rich UI that groups shots by scene for clear narrative flow.
    *   Real-time status tracking for each shot (e.g., `Generating JSON`, `Needs Review`, `Generation Failed`).
    *   In-app JSON editor for fine-tuning VEO prompts.
    *   Per-shot ingredient image management and regeneration capabilities.
*   **Local Project Management & Export:**
    *   **Save & Load:** Save your entire project state (shots, logs, images) to a local `.json` file and load it back in later to resume work.
    *   **Direct Downloads:** Export all assets directly to your computer. No external integrations needed.
*   **Director's Log:** Provides a real-time activity log of the entire generation process, from script analysis to final export.

## How It Works: The Workflow

The VEO 3.1 Prompt Machine streamlines the creative-to-production pipeline through a sophisticated, multi-step process powered by the Gemini API.

1.  **Input & Setup:** The user provides a script and optional "ingredient" images. They can also choose whether to auto-generate keyframes for all shots upfront or load a previously saved project file.

2.  **Initial Analysis (Gemini `gemini-2.5-pro`):**
    *   A project name is generated (e.g., `robot-detective-neo-tokyo`).
    *   The script is broken down into a fundamental shot list (e.g., `scene1_shot1`, `scene1_shot2`, etc.), each with a natural language "pitch".
    *   Descriptive names are generated for each scene based on the shots within it.

3.  **Strategic Scene Planning (Gemini `gemini-2.5-pro`):**
    *   This is the core of the "ScenePlan + Extend" logic. For each scene, the system generates a `scene_plan.json`.
    *   This plan defines the narrative beats, their target durations, and an `extend_policy`. This policy sets the rules for when adjacent shots can be "chained" together into a longer, continuous video segment, based on criteria like character continuity, consistent lighting, and camera axis.

4.  **VEO JSON Generation (Gemini `gemini-2.5-pro`):**
    *   For each shot, the model receives the full script, the specific shot pitch, and the *entire scene plan*.
    *   Guided by the `extend_policy`, it decides whether to generate a standard single-shot JSON or a multi-segment "extend" JSON wrapper. This allows for the creation of video clips longer than the base 8-second limit by intelligently stitching shots together.
    *   The output is a `VeoShotWrapper` that standardizes the structure for both single and chained shots, now including `directorNotes` for extend blocks.

5.  **Keyframe Generation (Gemini `gemini-2.5-flash-image`):**
    *   If enabled, a keyframe is generated for each shot using the generated VEO JSON as a detailed prompt, along with any specified ingredient images. This provides immediate visual feedback.

6.  **Review & Refine:**
    *   The user interacts with the Shot Book UI. They can review keyframes, edit VEO JSON directly, change the ingredient images for a specific shot and regenerate its keyframe at any time.

## Project Management & Exporting

All outputs are saved locally, giving you full control over your project assets.

*   **Save Project:** Saves the entire session—including all shots, generated JSON, keyframe images (as base64), and logs—into a single `.json` file.
*   **Load Project:** Loads a previously saved session `.json` file, restoring the application to its exact saved state.
*   **Download Report:** Generates and downloads a standalone HTML file containing a master shot list, complete with keyframes and VEO JSON, **API call counts, token usage, and estimated costs**, for easy sharing and review.
*   **Download VEO JSONs:** Downloads a single `.json` file containing an array of all the VEO JSON prompts generated for the project.
*   **Download Keyframes:** Packages all generated keyframe images into a single `.zip` file for convenient download.

## Technical Stack

*   **Frontend:** React, TypeScript, TailwindCSS
*   **AI Models (Google Gemini API):**
    *   `gemini-2.5-pro`: Used for all logical and text-based generation tasks (shot lists, scene plans, VEO JSON).
    *   `gemini-2.5-flash`: Used for faster, lower-cost text-based tasks (project name, scene names).
    *   `gemini-2.5-flash-image`: Used for generating all visual keyframes.
*   **Libraries:** `lucide-react` for icons, `pdf.js` for script ingestion, `jszip` for creating zip archives.

## Roadmap (Future Considerations)

*   **Backend Integration for Persistent Storage:** Explore options like Google Cloud Storage (GCS) or Firebase for storing project files and assets, moving beyond local browser storage. This would enable:
    *   Multi-project management and indexing.
    *   Structured node storage with rich metadata (as suggested by user).
    *   Version control for project iterations.
    *   Collaborative features.
*   **Enhanced Reporting:**
    *   Integration of actual billing data (requires backend).
    *   More customizable report templates.
*   **Advanced Prompt Engineering:**
    *   Dynamic prompt chaining and iteration loops.
    *   User-injectable commentary for 'director_notes' to feed back into system.
*   **Audio/Video Generation:** Deeper integration with VEO's full audio and video generation capabilities beyond just keyframes.