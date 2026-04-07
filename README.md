<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/38bbca2f-69c6-470c-b976-716ae3ae185e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Property Code Migration (4-digit unique)

To enable automatic non-repeating 4-digit property codes for existing and new properties, run:

`sql/property_code_migration.sql`

in your Supabase SQL Editor.

## Sync History Migration

To enable sync history and rollback, run:

`sql/sync_history_migration.sql`

in your Supabase SQL Editor.
