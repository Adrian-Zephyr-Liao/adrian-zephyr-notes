# Articles Page Overrides

> **PROJECT:** Zephyr Notes Admin
> **Generated:** 2026-07-15 00:26:31
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1600px, centered inside the shell
- **Grid:** Four compact metrics, then one article workspace surface
- **Sections:** 1. Metrics, 2. Filter toolbar, 3. Article table/list, 4. Pagination

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- Use the existing Chinese sans stack. Use tabular figures for metrics and monospace for slugs.

### Color Overrides

- Use teal for primary actions, green for published state, warm rose for reposted content, and
  neutral glass for filters and rows. Status meaning must include text or icons, not color alone.

### Component Overrides

- Search and filter controls require visible labels.
- The primary action is "New article"; taxonomy and refresh actions remain secondary.
- Article titles are direct edit links; the trailing pencil action is icon-only with an accessible
  name.
- Mobile rows stack metadata without horizontal scrolling. Desktop rows use stable grid columns.

---

## Page-Specific Components

- Compact metric card
- Labeled filter toolbar
- Responsive article row
- Icon pagination controls

---

## Recommendations

- Keep blur localized to persistent navigation, page header, cards, toolbar, and popovers.
- Preserve a stable z-index scale of 20 for the page header, 30 for navigation, and 50 for overlays.
- Truncate titles, descriptions, and slugs without shifting the row grid.
- Use skeletons for list loading and disable refresh while a request is active.
