/** The blog (src/routes/blog.*). English only. */
export const BLOG_MESSAGES = {
  "blog.title": ["Blog", "the name of the section, used as a heading and as a link"],
  "blog.tagline": "Guides on choosing, buying and running business software.",
  "blog.back_to_site": ["Back to Software Vala", "link out of the blog to the site"],
  "blog.back_to_index": ["Back to the blog", "link from one article to the list"],
  "blog.empty_title": ["Nothing to read here yet", "shown when no article has its text saved"],
  "blog.empty_body":
    "Articles are written and published from the SEO Manager. As soon as one has its text saved, it appears here.",
  "blog.not_available": [
    "That article is not available.",
    "shown when an article is unpublished, missing, or has no text stored",
  ],
} as const;
