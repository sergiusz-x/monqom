# Help center content

Help articles live in `frontend/src/help/content/<locale>/` as Markdown files. Each article needs a matching filename in every supported language and a `title` in its frontmatter. Set `category` to group articles in the navigation and optionally set `subcategory` for a nested group. Translate these names in each locale and use the same names for articles in the same group. Set `sidebar.order` to control their order; keep articles in each category and subcategory together. The `index.md` file is the help center home page.

Link to another article with `/help/<locale>/<filename>/`. Screenshots under `/marketing/screenshots/<locale>/` can use a `-light.png` or `-dark.png` filename: the help center automatically displays the variant matching the selected theme. Include descriptive alt text and provide both variants. To open a screenshot in the full-size preview, link the image to the same image file using `[![Description](/path/image-light.png)](/path/image-light.png)`.

The search index is built from the article titles, categories and rendered article text in the browser. Adding a language also requires adding it to the application's locale and translation resources.

Add `related: transactions, budgets` in frontmatter to link related articles by filename. Add `updated: YYYY-MM-DD` only after reviewing an article; omit it otherwise. Articles with at least four second-level headings get a table of contents automatically. Search ranks title matches first, followed by category and article text.

For examples of highlighted controls and multi-step captures, see `frontend/screenshots/help.spec.ts`. Highlights are applied temporarily to actual UI elements while taking the screenshot. Run `pnpm screenshots -- help-goals help-plan help-review` to regenerate the guide images.
