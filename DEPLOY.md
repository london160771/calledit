# Owner deployment: one Render service

Codex has not deployed this project or created a service. The owner performs these steps. One Express process serves the built React app and owns one Twitch session. Do not add a separate frontend, database or worker, or scale to multiple instances: live state is in memory.

## 1. Create the replay-only service

1. In Render, create a Blueprint from **https://github.com/london160771/calledit**, branch **main**, using root **render.yaml**. Applying it creates exactly one Node web service, calledit. Alternatively, create one Web Service manually with the settings below.
2. Check the plan: supplied config uses **Free**, **one instance**, **automatic deploys off**. Free can sleep; choose an always-on plan yourself if the recording requires it. No paid service is created by this repo.
3. Root directory: repository root. Build: `npm ci --include=dev && npm run build -w web`. Start: `npm start`. Node: **22**. Health path: **/healthz**. Render supplies PORT and RENDER_EXTERNAL_URL; Node binds 0.0.0.0 on Render. Keep one process and instance.
4. Deploy it yourself, initially without Twitch values. Open **https://YOUR-SERVICE.onrender.com/judge**. Run demo/attacks and confirm **2/2/0**. /healthz should return `{ "ok": true }`. No Twitch environment values are required.

Official references: [Express service](https://render.com/docs/deploy-node-express-app), [Blueprint fields](https://render.com/docs/blueprint-spec), [environment variables](https://render.com/docs/environment-variables), [Free sleep limits](https://render.com/docs/free).

## 2. Enable live Twitch on the same service

1. In your confidential Twitch application's OAuth redirects, register **https://YOUR-SERVICE.onrender.com/auth/callback**, using the actual public URL exactly.
2. Add variables in Render's service Environment settings, then save/redeploy yourself:

| Variable | Value |
|---|---|
| TWITCH_CLIENT_ID | Your Twitch application Client ID |
| TWITCH_CLIENT_SECRET | Matching private client secret |
| DASHBOARD_PASSWORD | Long private owner password; never put it in a source/browser URL |
| LIVE_SYNC_WINDOW_MS | 45000, already set in render.yaml |
| LIVE_MAX_DELAY_MS | 45000, already set in render.yaml |

Do **not** upload your local .env or its localhost TWITCH_REDIRECT_URI / PORT to Render. APP_ORIGIN defaults to RENDER_EXTERNAL_URL; TWITCH_REDIRECT_URI defaults to that origin plus /auth/callback. For a custom domain, set APP_ORIGIN to the full https:// origin and register that exact callback. An explicitly set TWITCH_REDIRECT_URI must match APP_ORIGIN + /auth/callback. Do not put credentials in Git or VITE_ variables. Access/refresh tokens are optional; prefer OAuth.

3. Open **https://YOUR-SERVICE.onrender.com/dashboard?liveSync=1**. At the HTTP Basic prompt use username **owner**, password **DASHBOARD_PASSWORD**. Connect with Twitch and authorize **ayyoweb3**, the intended broadcaster/bot. Scopes: user:read:chat, user:write:chat, user:bot.
4. Check subscription.created shows **ayyoweb3**, **enabled**, then eventsub.connected. A different sign-in changes this single session's channel; only the password holder can authorize/control it. Public readers can see round/chat/measurement state, never tokens/passwords.
5. OBS URL: **https://YOUR-SERVICE.onrender.com/overlay?live=1**, **1280x720**, transparent and visible on stream. No password belongs in this URL. Overlay/state reads are public; OAuth routes and live control writes require owner credentials.

## 3. Verify and record

1. Keep the service awake for recording, refresh OBS and recalibrate with three syncs. Reconnect/resync after every restart/redeploy: there is no persisted state or OAuth memory. Stop the old local Twitch session when switching to hosted; do not run both against the same channel.
2. Confirm measured roles. Gate 0 used iPhone fast / laptop slow; the money shot later used sammiedfab slow. Recalibrate within ten minutes. D_v includes reaction/chat delay.
3. Open a round, mark LANDED at the event, then reproduce fast-after-seeing **LATE_SAW_IT** and slow-before-seeing **ACCEPTED**. Confirm numeric cards appear **on stream**, remain after Final, and clear only on next round/Sync. Confirm plain STALE_SYNC guidance separately if needed.
4. Wait 45 seconds after eventAt: expect round.finalized and exactly one summary.sent. Chat summary now includes blocked count/codes. The echoed bot summary should produce chat.ignored / OWN_ACCOUNT, not sync.rejected / WORD_MISMATCH.
5. Complete the **pending live gap check** in a separate round. Interrupt EventSub connectivity without killing Node; use the local guide's network test if you cannot selectively interrupt hosted networking. Expect round.voided and VOID / ROUND_VOID_GAP, no score. Closing a browser must not void it. Restarting a memory-only server loses the round, so that is not equivalent live gap evidence.
6. Record/link a public demo under three minutes showing Twitch operation and how Codex was used. Supply the actual Codex session ID, evidence links and repository access, then submit on Devpost yourself. No video/session ID is fabricated here. See [official submission requirements](https://twitchcon-codex.devpost.com/rules).

## Operations and limits

- Free services can sleep/cold-start. Loaded /judge needs no Twitch/API, but first load still needs files from the service. Free availability is not a live uptime guarantee.
- Automatic deploys are off in the Blueprint. Deploy tested commits manually outside rounds. Restart/redeploy clears calibration/round/OAuth memory: reauthorize and resync. Multiple instances are unsupported.
- summary.failed means no confirmed Helix send; no automatic retry, because a timed-out send may already be in chat. State/logs distinguish pending/sent/failed.
- Browser-only failures show Reconnecting to CalledIt server. Twitch disconnected means the Node session is down. Live pages back off/reconnect and refresh on visibility/online.
- Rotate leaked credentials in Render/Twitch, then redeploy/reconnect. Keep passwords/tokens out of evidence, screenshots and video.

No Render deploy command is needed in this repository. Deployment and submission remain owner actions.
