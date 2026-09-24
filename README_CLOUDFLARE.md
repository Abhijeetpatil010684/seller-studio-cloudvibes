# Seller Studio V7.6 — CloudVibes Teal UI

Same Seller Studio workflow, now with the CloudVibes peacock-teal identity and improved mobile responsiveness.

Changes:
- Deep peacock-teal navigation
- Cool-grey workspace and white operational cards/tables
- Teal primary actions
- Sage success, coral warning/error, restrained gold secondary accents
- Product thumbnails kept on white for stronger jewellery contrast
- Mobile hamburger / slide-out navigation
- Two-column KPI layout on smaller screens where practical
- Responsive top actions and mobile bottom-sheet style modals
- Operational tables remain horizontally scrollable so no columns/data are removed

Data safety:
The localStorage key remains `sellerStudioV75CloudVibes`.
This is intentional so replacing the deployed UI on the same browser/domain does not reset the current locally stored inventory/orders.

Cloudflare Pages:
- Keep the existing Seller Studio GitHub repository
- Keep the existing Seller Studio Cloudflare Pages project
- Production branch: main
- Framework preset: None
- Build command: npm run build
- Build output directory: dist
- Root directory: blank
- No environment variables for this version

Do not create another Worker or another Seller Studio Pages project.
