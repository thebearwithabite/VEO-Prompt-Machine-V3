# VEO 3.1 Prompt Machine

An interactive Director's Assistant that transforms creative scripts into structured, production-ready VEO 3.1 JSON prompts, complete with keyframes, scene plans, and collaborative editing features.

## Core Features

*   **Script Ingestion:** Accepts creative input via direct text paste or file upload (.txt, .md, .rtf, .pdf).
*   **Smart Asset Library (New):**
    *   **Auto-Detection:** AI analyzes your script to identify key Characters and Locations automatically.
    *   **Persistence:** Assets are saved independently of the script, allowing you to build a library of recurring characters to use across multiple episodes or scenes.
    *   **Intelligent Mapping:** The system automatically assigns the correct Character/Location assets to shots based on the script context.
*   **Automated Pre-Production Pipeline:**
    *   **Project Naming:** Intelligently generates a filesystem-safe project name.
    *   **Shot Breakdown:** Breaks script into a detailed shot list with natural language pitches.
    *   **Scene Planning:** Generates strategic `ScenePlan` logic (narrative beats, timing, extending shots) for VEO.
    *   **VEO 3.1 JSON Generation:** Creates production-ready JSON prompts, handling complex "Extend" logic for longer sequences.
    *   **AI Keyframing:** Generates 2K cinematic keyframes using `gemini-3-pro-image-preview`.
*   **Interactive Shot Book:**
    *   Real-time status tracking.
    *   In-app JSON editor.
    *   **Asset Toggling:** Manually override which assets are used for specific shots to fine-tune the visual output.

## Project Management & Data Safety

**Important:** This application runs entirely in your browser.
*   **Local Storage:** Your work is saved to your browser's "Local Storage" so you don't lose it if you refresh. **This is NOT cloud storage (like Google Drive).** If you clear your cache or use Incognito mode, your data will be erased.
*   **Save Project:** Always use the **"Save Project"** button to download a `.json` backup to your actual computer.

## Exporting for Production

We provide structured exports designed to fit into your production workflow or AI File Organizers.

*   **Export Package (Recommended):** Downloads a structured `.zip` ready for ingestion by file organizers.
    *   `/Assets`: Structured folders for Characters and Locations with sidecar `.json` metadata.
    *   `/Source`: The original script text.
    *   `/Production`: The full shot list and individual VEO JSON prompt files.
*   **Report:** A standalone HTML file with visual storyboards and API cost estimation.
*   **Keyframes:** A zip of all generated images.

## Technical Stack

*   **Frontend:** React, TypeScript, TailwindCSS
*   **AI Models (Google Gemini API):**
    *   `gemini-3-pro-preview`: Logic, Script Analysis, Scene Planning, VEO JSON.
    *   `gemini-3-pro-image-preview`: High-fidelity Keyframe Generation (2K).
    *   `gemini-2.5-flash`: Lightweight text tasks (naming).

## Workflow Guide

1.  **Input Script:** Paste your text.
2.  **Visual Assets:** Click "Auto-Detect Assets". The AI will find characters and locations. Upload reference images for them.
3.  **Generate:** The system creates the shot list and VEO prompts.
4.  **Review:**
    *   Check the Shot Book.
    *   If a shot looks wrong, check the **"Key Assets"** section on the card. Did it grab the wrong character? Toggle it off and regenerate the keyframe.
5.  **Export:** Click "Export Package" to move your data to your permanent file system.
