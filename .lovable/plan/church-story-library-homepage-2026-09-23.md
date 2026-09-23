# Church Story Library Homepage

## Direction
Build the selected **Premium editorial mosaic** direction for the public Story Library, using FlowLeed’s existing colors and typography rather than the prototype’s serif font or a separate palette. The uploaded wireframes remain visual references only.

The result should feel like a carefully edited church story journal: human, visual, emotional, and premium. It will replace the current repeated portrait-video grid with a flexible composition where each story’s format determines its presentation.

## Homepage structure

1. **Quiet church header**
   - Keep the church logo as the primary identity.
   - Retain the existing AI story search in a more restrained, editorial treatment.
   - Keep mobile search easy to reach without allowing it to dominate the page.

2. **Featured story opening**
   - Create a two-part opening composition matching the selected direction: large editorial headline and story details beside an immersive featured visual.
   - Adapt the visual frame to the featured story’s orientation rather than assuming every feature is portrait.
   - Preserve Watch and More info behavior using the real featured story and existing links.
   - Leave a visible hint of discovery content below the first viewport.

3. **Story discovery**
   - Keep topic filtering, but reduce the chip-heavy catalog feeling.
   - Place the AI search as a dedicated “What story do you need today?” discovery moment between the feature and the mosaic.
   - Preserve the current search results, citations, playback, clear-search behavior, and session persistence.

4. **Curated mixed-media mosaic**
   - Replace the uniform four-column grid with an asymmetric editorial sequence.
   - Introduce reusable visual treatments for:
     - horizontal 16:9 film
     - vertical 9:16 short story
     - stories with both orientations
     - written story
     - photography-led story
     - quote
     - written story with images
     - short-form video
     - long-form video
   - Use varied widths, heights, image crops, text density, and metadata placement while maintaining one coherent visual system.
   - Give every story a clear media label, duration or reading cue, title, and interaction affordance.
   - Use real library content only; no invented people, titles, quotes, or stories.

5. **More stories rhythm**
   - Follow the main mosaic with a lighter horizontal or compact sequence for additional short stories.
   - Avoid turning this section back into identical cards; portrait, landscape, and text-led entries will retain appropriate proportions.

## Responsive behavior
- On desktop, use a stable 12-column mosaic with intentional spans and no awkward empty cells.
- On tablet, simplify to a two-column editorial rhythm.
- On mobile, turn the mosaic into a deliberate single-column reading sequence: featured story, discovery, landscape feature, written story, quote, portrait short, then more stories.
- Preserve natural media aspect ratios, readable text, 44px touch targets, safe-area spacing, and internal page scrolling.

## Current-content handling
The current public page loads only video records. This redesign will render those real videos in the new editorial system now, while structuring the story renderer around explicit presentation variants so written, photo, quote, and combined formats can enter the same mosaic when those content records become available. No new content storage or church-selectable palette settings are included in this visual homepage pass.

## Technical details
- Refactor the public homepage into focused presentation components rather than one large page file.
- Add semantic Story Library design tokens to the global theme and consume them through Tailwind classes.
- Keep the existing public organization lookup, public-content permissions, YouTube player, thumbnails, topic analysis, and AI search behavior unchanged.
- Use the existing FlowLeed font family and controls; no remote font import.
- Add restrained image-reveal and hover motion with reduced-motion support.
- Verify the real public page at desktop and mobile widths, including featured playback, topic filtering, AI search layout, story links, empty/loading states, and mixed aspect-ratio stability.
