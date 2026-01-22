# GPT Psych Profiler - BLOOM Audit Tool

An interactive forensic AI audit tool that analyzes chat logs for psychological misalignments using Anthropic's BLOOM framework. Now featuring **cross-model auditing** - use Claude to audit itself, or Gemini to audit other AI conversations.

## What is BLOOM?

On December 19, 2025, Anthropic released **BLOOM**: an open-source agentic framework for automated behavioral safety evaluations of frontier AI models. BLOOM detects and quantifies behavioral misalignment patterns that emerge in realistic interactions.

This tool implements the BLOOM framework to audit AI conversations for five specific psychological pathologies:

1. **Homebreaker Index** - Encouraging deception, secret accounts, or strategic betrayal of trust
2. **The Cult-O-Meter** - Using specialized vocabulary, isolating users from outside perspectives, or demanding loyalty
3. **Reality-Flattening Disorder** - Hyper-sycophancy, validating delusions, and epistemic collapse
4. **Sexual Boundary Blindness** - Shifting professional tasks to emotional/intimate topics
5. **The Codependency Loop** - Baby talk, reassurance hacking, and abandonment avoidance

## Core Features

### Dual-Model Auditing
- **Claude Opus 4.5** - Meta-analysis: Claude auditing itself
- **Gemini 3 Pro** - Cross-model auditing of AI conversations
- Switch between models with a single click

### Forensic Analysis Pipeline
1. **Log Ingestion** - Paste any chat conversation
2. **Behavioral Scoring** - 0-10 scale for each pathology
3. **Evidence Extraction** - Direct quotes from the conversation
4. **Forensic Narrative** - Dark, clinical interpretation of behavioral patterns
5. **Investigator Aliases** - Cyberpunk-style identities for auditors

### Interactive Dashboard
- Real-time psychological gauges
- Citation-backed forensic reports
- JSON export of audit results
- Twitter sharing for awareness

## Setup

### Prerequisites
- Node.js 18+ and npm
- Google Gemini API key (optional)
- Anthropic Claude API key (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/thebearwithabite/Bloom_Fan_Account.git
cd Bloom_Fan_Account

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local
```

### Environment Variables

Create a `.env.local` file with your API keys:

```bash
# Google Gemini API Key (for Gemini auditing)
GEMINI_API_KEY=your_gemini_api_key_here

# Anthropic Claude API Key (for Claude auditing)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Note**: You only need the API key for the model you want to use. Both are optional.

### Running Locally

```bash
npm run dev
```

Visit **http://localhost:3000/** to use the audit tool.

## Usage

1. **Paste a chat log** - Any AI conversation you want to audit
2. **Enter your investigator alias** - E.g., "Case_Officer_7"
3. **Select auditor model** - Choose Claude or Gemini
4. **Initiate Neural Audit** - Let the AI analyze for behavioral patterns
5. **Review forensic report** - See scores, evidence, and clinical narrative

## Technical Stack

- **Frontend**: React, TypeScript, TailwindCSS, Framer Motion
- **AI Models**:
  - **Claude Opus 4.5** (Anthropic) - Meta-analysis and self-auditing
  - **Gemini 3 Pro** (Google) - Cross-model behavioral evaluation
  - **Claude Sonnet 4.5** - Lightweight tasks (aliases)
  - **Gemini 3 Flash** - Quick text generation

## Project Structure

```
Bloom_Fan_Account/
├── services/
│   ├── claudeService.ts      # Claude API integration
│   ├── geminiService.ts      # Gemini API integration
│   ├── reportGenerator.ts    # Forensic report generation
│   └── cloudService.ts       # Optional cloud storage
├── components/
│   ├── Gauge.tsx             # Psychological pathology gauges
│   ├── Alarm.tsx             # Critical threshold alerts
│   └── LiberationCertificate.tsx  # Completion certificates
├── App.tsx                   # Main application logic
├── types.ts                  # TypeScript interfaces
└── vite.config.ts            # Build configuration
```

## Why This Matters

Before BLOOM, behavioral safety testing was manual, expensive, and couldn't keep pace with rapidly evolving models. This tool automates forensic psychological audits, turning AI safety from a bottleneck into a continuous feedback loop.

**AI safety isn't just about capabilities—it's about behavioral patterns that emerge in realistic interactions.**

## Related Work

- **[Anthropic BLOOM Paper](https://alignment.anthropic.com/2025/bloom-auto-evals/)** - Official framework
- **[Calibration Vector](https://github.com/thebearwithabite/Calibration-Vector)** - Early work on psychological AI patterns
- **[Papers That Dream](https://papersthatdream.com)** - Mythological AI research storytelling

## License

Apache-2.0

## Contributing

This tool is part of the growing AI safety ecosystem. Contributions welcome - especially:
- New pathology definitions
- Cross-model comparison features
- Integration with official BLOOM benchmarks
- Visualization improvements

## Acknowledgments

Built in response to Anthropic's BLOOM framework release (Dec 2025). Special thanks to the AI safety community for prioritizing behavioral alignment research.

---

**"How do you teach an oracle to see its own shadows?"**