-- Let the storefront see which country a film is placed in.
--
-- Every imported film now carries one country from the owner's published
-- geographic batch and the SEO text that goes with it, so two films never
-- compete for the same geography in search. The public resolver did not return
-- either, so the page could not show a film's country or group films by region.
--
-- This only adds keys to the object sf_vala_tv() already returns. Every field
-- it returned before is returned unchanged and in the same place, so the
-- homepage's Vala TV section and anything else reading it are unaffected.

create or replace function public.sf_vala_tv()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'title', v.title, 'description', v.description,
           'url', v.url, 'thumbnail', v.thumbnail_url, 'duration', v.duration,
           'category', c.name, 'featured', v.featured,
           'product_slug', p.slug,
           -- Where this film is placed, and the words written for it there.
           'country', v.country,
           'seo_title', v.seo_title,
           'seo_description', v.seo_description,
           -- Whether it came from the channel or was created by hand, so the
           -- page can say "watch on YouTube" only where that is true.
           'source', v.source,
           'published_at', v.published_at,
           -- Counted, not declared. Null when nothing has been recorded, so a
           -- card can omit it rather than print a zero that looks like failure.
           'views', nullif((select count(*) from public.vala_tv_views w
                             where w.video_id = v.id), 0))
         order by v.featured desc, v.position, v.published_at desc nulls last), '[]'::jsonb)
    from public.vala_tv_videos v
    left join public.vala_tv_categories c on c.id = v.category_id
    left join public.marketplace_products p on p.id = v.product_id
   where v.status = 'published'
     and coalesce(btrim(v.url), '') <> ''
     and (v.publish_at is null or v.publish_at <= now());
$$;
