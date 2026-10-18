-- The public legal pages, written and published.
--
-- /terms, /privacy, /legal and /refund-policy have all answered 404 since the
-- site went up, and the storefront footer has carried no Legal column at all.
-- That was not an oversight in the code: sf_legal_href() and legal_policies
-- were built for exactly this and legal_policies was empty, so there was
-- nothing to link to. The footer says so in its own comment - the pages "have
-- to be written and published in the Legal Manager before they can be linked".
--
-- This writes them. The wording of the commercial position is the owner's,
-- given in his own words, and is reproduced here in substance rather than
-- invented:
--
--   * No advance payment is taken. The customer sees a demo first, receives
--     the software, verifies it, and pays afterwards.
--   * Because of that order, there is no refund situation to arise.
--   * Once the source code is handed over, Software Vala's responsibility for
--     what happens to it ends. If the customer changes or breaks something,
--     that is the customer's doing.
--   * Where a legal issue on the server is genuinely Software Vala's fault,
--     Software Vala will do what is right.
--   * A customer's expired domain, expired hosting, expired SSL certificate or
--     failed payment gateway is not Software Vala's responsibility.
--
-- These rows are ordinary Legal Manager records. They are drafts of the
-- business's position written in plain language, not legal advice, and the
-- owner can edit every word of them in the Legal Manager without a deploy.
--
-- Nothing is removed. If a policy of the same ref_code already exists this
-- migration leaves it exactly as it is, so re-running it can never overwrite
-- something the owner has since edited.

-- ---------------------------------------------------------------------------
-- Reading a published policy from the public site.
-- ---------------------------------------------------------------------------
-- legal_policies is operator-and-reviewer only, and stays that way: drafts,
-- compliance scores and review dates are not the public's business. These two
-- functions expose only what has been published, and only the fields a reader
-- needs, in the same shape as sf_vala_tv() and the rest of the storefront
-- resolvers.

create or replace function public.sf_legal_index()
returns table (slug text, name text, policy_type text, version text, last_updated date)
language sql stable security definer set search_path = public, pg_temp as $$
  select lower(regexp_replace(p.policy_type, '[^a-zA-Z0-9]+', '-', 'g')) as slug,
         p.name,
         p.policy_type,
         p.version,
         p.last_updated
    from public.legal_policies p
   where p.status = 'published'
     and (p.effective_from is null or p.effective_from <= current_date)
   order by p.name;
$$;

create or replace function public.sf_legal_policy(p_slug text)
returns table (slug text, name text, policy_type text, version text,
               last_updated date, effective_from date, content text)
language sql stable security definer set search_path = public, pg_temp as $$
  select lower(regexp_replace(p.policy_type, '[^a-zA-Z0-9]+', '-', 'g')) as slug,
         p.name,
         p.policy_type,
         p.version,
         p.last_updated,
         p.effective_from,
         p.content
    from public.legal_policies p
   where p.status = 'published'
     and (p.effective_from is null or p.effective_from <= current_date)
     and lower(regexp_replace(p.policy_type, '[^a-zA-Z0-9]+', '-', 'g')) = lower(p_slug)
   order by p.last_updated desc nulls last
   limit 1;
$$;

revoke all on function public.sf_legal_index() from public;
revoke all on function public.sf_legal_policy(text) from public;
grant execute on function public.sf_legal_index() to anon, authenticated, service_role;
grant execute on function public.sf_legal_policy(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The policies themselves.
-- ---------------------------------------------------------------------------

insert into public.legal_policies
  (ref_code, name, policy_type, status, version, last_updated, updated_by,
   compliance_score, effective_from, review_due, content)
values
(
  'SV-LEGAL-PRIVACY',
  'Privacy Policy',
  'privacy-policy',
  'published',
  '1.0',
  current_date,
  'Software Vala',
  0,
  current_date,
  current_date + interval '1 year',
$md$# Privacy Policy

**Software Vala™ — The Name of Trust**

This policy explains what Software Vala collects when you use softwarevala.net, why we collect it, who else can see it, and what you can ask us to do about it. It is written to be read, not to be got past.

## Who we are

Software Vala is a software marketplace and development business operating from India. You can reach us at any time:

- Email: hellosoftwarevala@gmail.com
- WhatsApp: +91 87688 78787 or +91 83488 38383
- Website: https://softwarevala.net

If you want to raise something about your personal data specifically, write to the email address above with "Privacy" in the subject line.

## What we collect, and when

**When you simply browse the site**, we do not ask you to identify yourself and we do not set advertising cookies. Our web server records the ordinary technical details every web server records: the address your request came from, the page you asked for, the time, and what browser you used. We use this to keep the site running and to find faults.

**When you choose a language**, that choice is stored in your own browser. It never reaches us as a profile about you.

**When you ask us something** — through the contact form, a demo request, an enquiry, a callback or WhatsApp — we collect what you type: your name, your email address, your phone number if you give one, and the message itself. We keep it because we have to in order to answer you.

**When you create an account**, we collect your email address and the sign-in details you choose. Your password is stored by our authentication provider in hashed form; we never see it.

**When you buy something**, we record the order, what was in it, the amount, the currency and the payment reference our payment provider returns. **We do not collect, see or store your card number, CVV or UPI PIN.** Those go directly to the payment provider.

**When you use an AI feature**, the text of your request is sent to the AI provider we have configured in order to answer it. Do not put anything in an AI prompt that you would not want processed by a third party.

## Why we are allowed to hold it

- To do what you asked us to do — answer your enquiry, run your demo, complete your order.
- To meet obligations the law puts on us, such as keeping records of sales and taxes.
- Because we have a legitimate interest in keeping the site secure, preventing fraud and abuse, and understanding which parts of the site work.

We do not sell your personal data. We do not rent it, trade it, or hand it to data brokers. We have never done so and this policy is our commitment not to.

## Who else sees it

Only the suppliers we need to run the service, and only the part each of them needs:

- **Hosting and infrastructure** — the servers the site runs on.
- **Authentication and database** — where your account and order records live.
- **Payment providers** — they receive what is needed to take a payment. They never send us your card details.
- **Email delivery** — to send you your acknowledgement, your invoice or your licence.
- **AI providers** — the content of a request you make to an AI feature.
- **Translation** — our translation engine runs on our own server. Page text is translated on infrastructure we control.

We may also disclose information where a law, a court or a lawful authority requires it, and we will tell you when we are permitted to.

## Cookies and browser storage

We do not use advertising or tracking cookies, and at the time of writing the site sets no cookies at all. We do use your browser's own local storage for things that only matter to you: your chosen language, your sign-in session, and small conveniences such as a remembered tab. That data stays in your browser. You can clear it at any time through your browser's settings, and the site will still work.

## How long we keep it

- **Enquiries and support messages** — while we are dealing with them and for a reasonable period afterwards, so we can pick up the thread if you write again.
- **Account records** — while your account exists.
- **Orders, invoices and payment records** — for as long as tax and accounting law requires us to. These we cannot delete on request, and we will tell you so plainly rather than pretend otherwise.
- **Server logs** — for a short operational period.

## What you can ask us to do

You can ask us to show you what we hold about you, correct it if it is wrong, delete it where we are not obliged to keep it, or stop using it for a particular purpose. You can also withdraw consent where our use rested on your consent. Write to hellosoftwarevala@gmail.com. We will respond, and if we cannot do what you asked we will say why.

## Keeping it safe

The site is served over HTTPS. Access to our systems is restricted by role, and sensitive credentials are stored encrypted. We take backups so that a failure does not become a loss.

No system is perfectly secure, and we will not claim otherwise. If a breach occurs that affects you, we will tell you.

## Children

The service is meant for businesses and adults. We do not knowingly collect personal data from children. If you believe a child has given us their data, write to us and we will remove it.

## Data leaving India

Some of the suppliers above operate outside India, so your data may be processed abroad. We use established providers and pass on only what is needed.

## Changes

We may update this policy as the service changes. The version and date at the top of the page always say which one you are reading, and material changes will be announced on the site.

## Complaints

Write to us first — hellosoftwarevala@gmail.com. If we cannot resolve it, you are entitled to complain to the relevant data protection authority.
$md$
),
(
  'SV-LEGAL-TERMS',
  'Terms of Service and Rules of Regulation',
  'terms-of-service',
  'published',
  '1.0',
  current_date,
  'Software Vala',
  0,
  current_date,
  current_date + interval '1 year',
$md$# Terms of Service and Rules of Regulation

**Software Vala™ — The Name of Trust**

These terms govern your use of softwarevala.net and anything you buy through it. By using the site or placing an order you accept them. Read the section on **scope of responsibility** carefully — it is the part that most often causes disagreement, and we would rather it were clear before you buy than argued about afterwards.

## 1. Who we are

Software Vala is a software marketplace and development business operating from India.

- Email: hellosoftwarevala@gmail.com
- WhatsApp: +91 87688 78787 or +91 83488 38383
- Website: https://softwarevala.net

## 2. How buying from us works

**We do not take advance payment.**

The order is deliberately the other way round from most of this industry:

1. You tell us what you need.
2. **We show you a working demo first.**
3. We deliver the software.
4. **You verify it** — you check that it does what was agreed.
5. **You pay after that.**

Nothing is asked of you before you have seen the thing working. This is the single most important commitment on this page, and everything below follows from it.

## 3. Source code, and what happens after handover

Where the agreement includes source code, we hand it over to you. From that moment it is in your hands.

**Once the source code has been handed over, our responsibility for what happens to it ends.** That is not a technicality; it is the natural consequence of you holding the code:

- If you or anyone working for you modifies the code and something stops working, that is your change.
- If something is broken during your own deployment, configuration or hosting, that is your deployment.
- If a third party you engage alters the software, we are not answerable for their work.

We are happy to be asked. Support, changes and further work after handover can be agreed separately, and we will quote for them like any other work.

## 4. What remains our responsibility

We do not walk away from our own mistakes.

**If a legal issue arises that is genuinely our fault, we will do what is right by you.** If the fault is ours, we own it.

## 5. What is not our responsibility

These are yours to maintain, and a failure in any of them is not a fault in our software:

- **Your domain name** — if it expires, the site stops resolving. That is a renewal you control.
- **Your hosting** — if it expires or is suspended, the site stops being served.
- **Your SSL certificate** — if it expires, browsers will warn your visitors.
- **Your payment gateway** — if your merchant account is suspended, rate-limited or fails, payments stop.
- **Third-party services and APIs you connect** — including their pricing, their outages and their policy changes.
- **Your own data, your own backups and your own passwords** after handover.
- **Changes you or anyone else makes to the delivered code.**

We will usually tell you what has gone wrong if you ask, because we would rather you were working than stuck. That is a courtesy, not an obligation we have taken on.

## 6. Your account

Keep your sign-in details to yourself. You are responsible for what is done through your account. Tell us at once if you think someone else has access to it.

## 7. Licences and intellectual property

Software you buy is licensed to you on the terms agreed for that product. Unless your agreement says otherwise in writing:

- The licence is for your own business use.
- You may not resell, redistribute or publish the software as your own product.
- "Software Vala", the Software Vala logo and the marks on this site remain ours.
- Anything you supply to us — your content, your data, your branding — remains yours.

## 8. How you may not use the service

Do not use the site or the software to break the law, to infringe somebody else's rights, to send unsolicited bulk messages, to attack or probe systems without permission, to misrepresent who you are, or to interfere with the service for other users.

We may suspend access where this section is being broken.

## 9. Demos

Demos exist so you can judge the software before you pay. They are for evaluation. A demo environment may be reset, may hold sample data, and is not intended to run your business.

## 10. Prices, payment and taxes

Prices are as shown at the time of the order. Taxes are applied as the law requires. Payment is due after delivery and verification, as set out in section 2. Where an invoice is issued, it is payable on the terms stated on it.

## 11. Refunds

See the Refund Policy. In short: because you see a demo first and pay only after you have verified the delivered software, the situation a refund exists to solve does not normally arise.

## 12. Availability

We work to keep the site and our services available, and we monitor them continuously. We do not promise uninterrupted availability, and we may take services down for maintenance. Where we have agreed a specific service level with you in writing, that agreement governs.

## 13. Limits on liability

Nothing here limits any liability that cannot lawfully be limited.

Subject to that, we are not liable for indirect or consequential loss, loss of profit, loss of business, loss of goodwill, or loss of data arising from your use of the software after handover. Our total liability in connection with any order is limited to the amount you paid us for that order.

## 14. Ending the relationship

You may stop using the service at any time. We may suspend or end access where these terms are broken. Ending it does not undo licences already granted or payments already due.

## 15. Changes to these terms

We may update these terms. The version and date at the top say which one you are reading. Continuing to use the service after a change means you accept the updated terms.

## 16. Governing law

These terms are governed by the law of India, and the courts of India have jurisdiction.

## 17. Talk to us first

If something has gone wrong, write to hellosoftwarevala@gmail.com or message us on WhatsApp before anything else. Most disputes are a misunderstanding about which side of section 3 a problem falls on, and most are settled in a conversation.
$md$
),
(
  'SV-LEGAL-REFUND',
  'Refund Policy',
  'refund-policy',
  'published',
  '1.0',
  current_date,
  'Software Vala',
  0,
  current_date,
  current_date + interval '1 year',
$md$# Refund Policy

**Software Vala™ — The Name of Trust**

## Why this policy is short

Most refund policies are long because the customer pays first and then finds out what they bought. Ours is short because **we do not take advance payment**.

The order of events is:

1. **You see a demo.** Working software, not a slide deck.
2. **We deliver.**
3. **You verify it does what was agreed.**
4. **You pay.**

You are never asked for money before you have seen the thing working and checked it yourself. Because payment comes last, the situation a refund exists to solve — paying for something that turns out not to be what you expected — does not normally arise.

## After source code handover

Where the agreement includes source code, our responsibility ends when the code is handed to you, and a refund is not available on the grounds of what happens to it afterwards.

The reason is straightforward: the code is in your hands. If it is modified and stops working, that modification was made on your side. If something breaks during your deployment, that deployment was yours. We cannot undo a handover, and we cannot be answerable for changes we did not make.

## Where we do put things right

We are not using this policy to avoid our own mistakes.

- **If we have not delivered what was agreed**, tell us. We will fix it. That is the point of the verification step, and it is where any problem should surface.
- **If a legal issue arises that is genuinely our fault**, we will do what is right by you.
- **If a payment is taken in error** — charged twice, charged the wrong amount, charged for something you did not order — tell us and we will return it. That is a mistake, not a refund request, and it will be treated as one.

## What is not refundable

A failure in something you maintain is not a fault in our software, and is not a ground for refund:

- your domain expiring
- your hosting expiring or being suspended
- your SSL certificate expiring
- your payment gateway failing or your merchant account being suspended
- a third-party service or API you connected changing its price, its terms or its availability
- changes made to the delivered code by you or by anyone you engaged
- work already completed and accepted at your verification step

## How to raise something

Write to **hellosoftwarevala@gmail.com**, or message **+91 87688 78787** or **+91 83488 38383** on WhatsApp, or use the contact form at https://softwarevala.net/contact. Quote your order number or your support reference.

Tell us what you expected and what you got. We will look at it properly and answer you. Where a payment does have to be returned, it goes back by the route it came in, and the timing after that is the payment provider's and your bank's.

## Talk to us first

Before raising a chargeback or a dispute with your bank or your card issuer, write to us. A chargeback on work that was demonstrated, delivered and verified costs both sides time and money over something that is usually a misunderstanding.
$md$
)
on conflict do nothing;

-- If the rows already existed under these ref_codes - because the owner
-- published them in the Legal Manager first - this migration must not tread on
-- his wording. There is no unique constraint on ref_code to hang an
-- `on conflict` clause from, so the guard is explicit: delete the duplicates
-- this run would have created, keeping the oldest row of each ref_code, which
-- is the one that was already there.
delete from public.legal_policies a
 using public.legal_policies b
 where a.ref_code = b.ref_code
   and a.ref_code in ('SV-LEGAL-PRIVACY','SV-LEGAL-TERMS','SV-LEGAL-REFUND')
   and a.created_at > b.created_at;

-- One ref_code, one policy, from here on.
create unique index if not exists legal_policies_ref_code_key
  on public.legal_policies (ref_code);
