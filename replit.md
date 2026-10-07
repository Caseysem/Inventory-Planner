# Inventory Planner

The imported application lives in `Inventory Planner GitHub Source/`. Keep its existing Node.js server and Python calculation solver.

## Run

- Use the **Start application** workflow to run the web preview. It builds the browser bundle, then starts the Node server on port 5000.
- For manual checks: `cd 'Inventory Planner GitHub Source' && npm run build && npm test`.
- Python 3.12 and Node.js 22 are configured; Python's pinned NumPy and SciPy dependencies are recorded in `requirements.txt` in the imported project and in the workspace Python package manifest.

## Access and publishing

- Publishing is allowed. Access is controlled by Replit: the deployment must be password protected / private, and the Secret `PLANNER_ACCESS=host-protected` tells the app not to show its own login. Without that Secret (and without the optional Microsoft 365 sign-in settings) the app shows a lock page and denies all inventory endpoints.
- Deployment type is Reserved VM (see `[deployment]` in `.replit`). Report data is stored as files in `data/`; a VM keeps them between requests, but they can be lost on redeploy until a database store is added. Do not switch to Autoscale until then.
- Health checks: `GET /` always returns 200. The lock page and unknown-host responses contain no data.
- NetSuite credentials go in Secrets only: NETSUITE_CLIENT_ID, NETSUITE_CERTIFICATE_ID, NETSUITE_PRIVATE_KEY_PEM. NetSuite access must remain read-only.
- Do not change planning calculations. See `Inventory Planner GitHub Source/Team Sign-In Setup.txt`, `README.txt` and `Replit Handoff.txt`.
