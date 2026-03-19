# AI backend for Flutter + fal.ai + Koyeb

This is a small Express backend for image and video generation with fal.ai.

## Files

- `server.js` - API server
- `package.json` - dependencies and scripts
- `.env.example` - environment variables template
- `.gitignore` - ignore local secrets and dependencies

## Local run

```bash
npm install
cp .env.example .env
npm start
```

Server routes:

- `GET /health`
- `POST /v1/ai/image/jobs`
- `GET /v1/ai/image/jobs/:requestId`
- `POST /v1/ai/video/jobs`
- `GET /v1/ai/video/jobs/:requestId`

## Deploy on Koyeb from GitHub

1. Push this folder to GitHub.
2. In Koyeb, create a new Web Service from GitHub.
3. If this backend is inside a Flutter monorepo, set the **Work directory** to this folder.
4. Add environment variables:
   - `FAL_KEY`
   - `PORT=8080`
   - Optional: `FAL_IMAGE_MODEL`, `FAL_VIDEO_MODEL`
5. Expose port `8080` as HTTP.
6. Start command: `npm start`

## Flutter

Run your Flutter app with:

```bash
flutter run --dart-define=AI_BACKEND_URL=https://your-service-name.koyeb.app
```

## Security

Do not commit `.env`.
Keep `FAL_KEY` only in Koyeb environment variables or secrets.
