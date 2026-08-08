# Handoff — add "Leaf Sweeper VR: Cozy Cleanup" to the portfolio

For a session working in `wamiq42.github.io` with no prior context on this game.
Everything needed is below; you do not need the game's source repo.

Delete this file once the pages are in.

---

## 1. What to produce

1. **A new detail page:** `projects/leaf-sweeper-vr.html`
2. **A new card** in `index.html`, in the `<section id="personal">` grid
3. The key art is already copied in at **`images/leaf-sweeper-vr-key-art.png`**
   (1672x941, 2.09 MB). Compress it and convert to `.webp` to match
   `baseball-x-banner.webp` — 2 MB is too heavy for a card thumbnail.

## 2. Lead with this

Every other entry in the Personal Projects section is in development or a learning
project. **This one is shipped, live on the Meta Horizon Store, and costs money.**

That is the single most important thing about this entry. It should read as the
portfolio's proof of delivery — concept through to store submission, storefront
assets, release notes and a post-launch patch. Do not bury it as "another VR project".

Suggested badge: `<span class="badge">Released</span>` (mirrors how
`echo-room-vr.html` uses `In development`). If the badge CSS has no released/positive
variant, add one rather than reusing the in-development styling.

**Place this card first** in the `#personal` grid, ahead of Echo Room VR.

## 3. Facts

| Field | Value |
|---|---|
| Title | Leaf Sweeper VR: Cozy Cleanup |
| Studio | W42Studios |
| Store | https://www.meta.com/experiences/leaf-sweeper-vr-cozy-cleanup/1287094717812314/ |
| Platform | Meta Quest 2, Quest Pro, Quest 3, Quest 3S |
| Genre | Cozy / relaxing simulation |
| Status | Released, Early Access. Currently version 1.1 |
| Engine | Unity 6 (6000.3.8f1), Universal Render Pipeline |
| XR stack | OpenXR, XR Interaction Toolkit 3.3.1 |
| Build | IL2CPP, ARM64, Android min SDK 29 / target 34 |

Include a prominent outbound link to the store page. It is the strongest single
element on the page — make it a real call-to-action button, not an inline link buried
in a paragraph.

## 4. What the game is

You clean up a garden after autumn. Five areas — the Barn, Courtyard, Playground,
Pool and Lawn — each buried in fallen leaves. You gather leaves into a trash bag you
physically carry, empty each full bag into the bin, and clear the area to unlock the
next one and earn coins. Coins buy better tools from a shop between runs.

Three tools, each with a genuinely different interaction model rather than a reskin:

- **Hands** — reach out and grab leaves directly. Short range, always available.
- **Rake** — leaves gather and stay physically piled on the rake head; you drag the
  pile across the garden and tip it into the bag. The only tool that works with the
  bag set down on the ground.
- **Leaf blower** — wide-cone, long range, sweeps leaves straight into a bag you are
  carrying.

## 5. Technical points worth writing up

Pick the two or three that read best; do not list all of them.

- **World-space UI built entirely in Unity UI Toolkit** (UXML/USS), not the usual
  Canvas approach. The gameplay HUD rides on the left controller as a wrist display
  and hides itself the moment that hand grabs something, so the panel never fights
  the object you are holding.
- **A custom OpenXR feature** implementing the `XR_FB_display_refresh_rate` extension.
  Quest boots its panel at 72 Hz and stays there unless an app asks for more; this
  queries what the runtime actually supports and requests the best rate up to 90 Hz,
  then matches the render target frame rate to it. Nothing is hardcoded — if the
  extension is missing it degrades cleanly.
- **Comfort-first VR design.** Device builds use physical head turning only — no snap
  turn, no continuous turn, the two most common causes of motion discomfort.
  Locomotion speed is a player setting adjustable mid-session from the pause menu,
  rather than something buried in a main menu you have to quit an area to reach.
- **Scale and performance.** Roughly 12,400 individually collectible leaves authored
  across the five areas, from 356 in the tutorial Barn up to 6,044 in the Lawn. Only
  the active area's leaves are live; the rest render as lightweight previews so the
  garden still looks populated. Leaf interaction is culled by proximity to the player
  on a refresh tick, keeping physics queries bounded regardless of area size.
- **Single Pass Instanced stereo rendering** on a Quest-specific URP pipeline asset.
- **Persistent progression** — a save system carrying coins, tool ownership, area
  unlocks and tutorial state across sessions.

## 6. Post-launch work (good "how I operate" material)

Version 1.1 was a patch driven by playing the shipped build and reading what players
hit:

- Reworked the coin economy so tools are earned across the run — the reward curve is
  weighted to later areas so no tool can be bought in the opening couple of levels,
  and replaying a cleared area pays a reduced reward so grinding the smallest area
  is not a shortcut.
- Changed area completion from a partial threshold to requiring every leaf, with a
  runtime safeguard that guarantees an area can always be finished even if individual
  leaves become unreachable.
- Fixed leaves being removed from the world without counting toward the bag, and the
  rake losing its gathered pile while carrying a bag to the bin.
- Removed an unused `INTERNET` permission from the Android manifest — the game does
  no networking, so it should not be asking for network access.

That last one is a nice detail for a portfolio: it shows attention to what the store
listing tells users about their privacy, not just to what the game does.

## 7. Page structure to follow

Copy the skeleton of `projects/echo-room-vr.html` exactly — same `<head>` block,
`nav`, `header.detail-hero`, `main.detail-body`, `footer`, and the
`../assets/js/main.js` include. Reuse the existing classes: `back`, `role-label`,
`badge`, `meta-row`, `tags` / `tag`, `features`, `container`.

Suggested hero:

```
role-label : Solo project - released on the Meta Horizon Store
h1         : Leaf Sweeper VR: Cozy Cleanup  <span class="badge">Released</span>
meta-row   : Genre: Cozy simulation | Platform: Meta Quest 2 / 3 / 3S / Pro |
             Engine: Unity 6 - URP - OpenXR - XR Interaction Toolkit
tags       : VR Interaction | UI Toolkit | OpenXR | Performance | Game Design | Shipped
```

Suggested `<h2>` sections: **The idea** -> **How it plays** -> **Built for comfort** ->
**Under the hood** -> **After launch**.

Set the `<meta name="description">` to something like:
*"Leaf Sweeper VR: Cozy Cleanup — a relaxing garden cleanup game for Meta Quest,
built and published solo by Wamiq Uddin. Available now on the Meta Horizon Store."*

## 8. Index card

```
images/leaf-sweeper-vr-key-art.webp  (after conversion)
role-label : Solo project - Released - VR
h3         : Leaf Sweeper VR: Cozy Cleanup  <span class="badge">Released</span>
blurb      : A cozy garden cleanup game for Meta Quest - rake, blow and gather
             autumn leaves across five gardens. My first commercially released
             title, built and shipped solo to the Meta Horizon Store.
```

## 9. Open items for Wamiq

- **Role wording is his to set.** The existing pages use "designed & built solo" —
  use whatever phrasing he confirms, do not invent a stronger claim.
- **No gameplay screenshots are prepared yet.** Only the key art. Two raw frame
  captures exist in the game repo under `Recordings/` but they are 19 MB and 39 MB
  PNGs and need cropping and compressing first. Until then the key art carries the
  page; consider pulling a couple of shots from the store listing instead.
- **Section placement.** It currently belongs under Personal Projects, but a shipped
  commercial title may deserve its own treatment or a "Released" section. Ask before
  restructuring `index.html`.
