# Agentic Fashion Imagery

Generate campaign-ready fashion shots from a single garment photo. Upload a flat-lay or ghost mannequin shot and receive high-end, on-model imagery covering multiple model profiles, shot angles, and art-directed vibes – ready for ecommerce listings, lookbooks, and social launches.

## Features

- Drag-and-drop garment uploader with instant preview
- Curated shot list presets (front hero, 3/4, detail, motion)
- Inclusive model lineup toggles to diversify your catalog
- Creative direction controls for vibe, target customer, and price positioning
- Server-side Replicate integration (Flux-based) with automated prompt engineering
- Download-ready PNG outputs plus full prompt metadata for reproducibility

## Tech Stack

- Next.js 14 (App Router, TypeScript, Edge-ready API routes)
- Tailwind CSS for design system tokens and glassmorphism treatment
- Replicate API (Flux) for image generation
- Lucide React icons

## Getting Started

1. Install dependencies:

   ```bash
   cd app
   npm install
   ```

2. Provide a Replicate API token and (optionally) model version in `app/.env.local`:

   ```bash
   echo "REPLICATE_API_TOKEN=your-token" >> .env.local
   # Optional: override the default Flux version
   # echo "REPLICATE_MODEL_VERSION=your-version-id" >> .env.local
   ```

3. Launch the dev server:

   ```bash
   npm run dev
   ```

4. Visit `http://localhost:3000` and upload a garment image to generate a lookbook batch.

## Building & Deployment

```bash
npm run lint
npm run build
```

The project is optimized for Vercel. Set `REPLICATE_API_TOKEN` (and optionally `REPLICATE_MODEL_VERSION`) as environment variables in your Vercel project before deploying.

## Notes

- The default configuration uses Flux (via Replicate) for photorealistic try-on rendering. Swap `REPLICATE_MODEL`/`REPLICATE_MODEL_VERSION` for alternative virtual try-on checkpoints if desired.
- Ensure uploaded photos are high-resolution with clean backgrounds for best fidelity.
- Prompt metadata and seeds are surfaced in the UI so you can iterate or re-run successful looks easily.
