# Inventory Planner

The imported application lives in `Inventory Planner GitHub Source/`. Keep its existing Node.js server and Python calculation solver.

## Run

- Use the **Start application** workflow to run the web preview. It builds the browser bundle, then starts the Node server on port 5000.
- For manual checks: `cd 'Inventory Planner GitHub Source' && npm run build && npm test`.
- Python 3.12 and Node.js 22 are configured; Python's pinned NumPy and SciPy dependencies are recorded in `requirements.txt` in the imported project and in the workspace Python package manifest.

## Current limitation

On Replit, the server intentionally displays an import/setup notice and denies all inventory and refresh endpoints. Do not remove the gate until team authentication and server-side authorization are implemented. NetSuite credentials are not present; configure them through Secrets only after authentication is in place. See `Inventory Planner GitHub Source/README.txt` and `Replit Handoff.txt` for the migration requirements. This setup is not ready for publishing.
