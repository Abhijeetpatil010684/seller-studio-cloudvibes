# CloudVibes Seller Studio

React + Vite public product catalogue and inventory administration for the existing Cloudflare Pages project. Pages Functions provide D1 state persistence, Access JWT verification and R2 photo upload.

Start with [SETUP.md](SETUP.md). No demo products or sales are seeded. Customer enquiries use WhatsApp when configured; payment checkout is outside this version.

```sh
npm ci
npm test
npm run build
```

`npm run dev` previews the React screens only. Database APIs need the Pages Functions runtime and configured bindings; this version never substitutes local browser data for a failed database connection.
