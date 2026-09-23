# Seller Studio V7.5 — CloudVibes / Cloudflare Pages

This is the SAME Seller Studio application based on V7.4 Compact.

No UI/workflow redesign was introduced.

Retained:
- Dashboard
- Master Inventory
- Purchase Register
- Product Setup
- Order / Sales Register
- Reports
- Settings
- Amazon-first multi-channel sales
- Update Existing Order for return/cancellation
- moving weighted-average purchase cost
- packaging/material consumption
- white/off-white compact UI

Added:
- 23 CloudVibes Amazon listings
- hero images
- CloudVibes SKU
- visible ASIN
- Amazon selling price
- MRP
- Refresh CloudVibes Products button

CloudVibes products start with stock=0 and purchase cost=0.
Enter actual stock purchases through Purchase Register.

## Cloudflare Pages with GitHub

Push this folder to the Git repository.

Cloudflare Pages:
- Production branch: main
- Build command: npm run build
- Build output directory: dist

No environment variables are required for this static version.

Important:
This version intentionally preserves the existing browser/localStorage data model.
Hosting it on Cloudflare makes the app accessible by URL, but data is still per browser/device.
A remote database can be connected later WITHOUT redesigning the interface.
