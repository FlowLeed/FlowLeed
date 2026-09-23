# Individual Story Page and Story Authoring

## Direction
Build the individual Story page as the personal continuation of the new Story Library homepage. Keep FlowLeed’s existing Story Library colors and typography, using the uploaded wireframes as composition references only.

The experience will follow **Story → Connection → Next Step**: immersive media and a person-first opening, an easy editorial narrative, one relevant invitation, then a small set of related stories. It will avoid video-platform chrome, sidebars, dense metadata, and generic blog styling.

## Public Story page

### 1. Shared church header
- Match the quiet header from the Story Library homepage, with the church logo linking back to the library.
- Keep navigation secondary so the person’s story remains the focus.
- Preserve internal page scrolling and safe-area spacing.

### 2. Adaptive story opening
Render the opening from the story’s actual format rather than forcing one frame:
- **Horizontal video:** a cinematic 16:9 media area with title, person/family name, short summary, and category arranged as an editorial introduction.
- **Vertical video:** a desktop split with story text on one side and a restrained 9:16 player on the other; on mobile the video becomes nearly full-width.
- **Written story with images:** a strong lead photograph with a clean title panel inspired by the supplied mobile reference.
- **Mixed media:** use the designated lead asset in the opening and let the remaining media appear naturally within the story.
- Show only essential context: category, title, person/family name, summary, and duration or reading time when useful.
- Keep playback, timestamp links, loading, unavailable-video handling, and the existing public permission checks.

### 3. Editorial story body
- Render a structured sequence of reusable story blocks: section heading, short paragraphs, image, image pair/gallery, pull quote, horizontal clip, and vertical clip.
- Allow optional narrative labels such as **Before**, **What Changed**, and **Today**, but never require them.
- Keep reading width comfortable and use photos or clips as pauses in the narrative rather than enclosing everything in cards.
- Existing video stories without authored sections will fall back gracefully to their real summary and key moments; no names, quotes, or life details will be invented.

### 4. One clear next step
- End the story with one visually distinct invitation containing a short headline, one sentence, and one primary button.
- Use a hybrid system:
  - organization-level defaults by category;
  - a per-story override when a more specific invitation is appropriate;
  - an AI suggestion action that proposes category and CTA copy from the existing story analysis, but requires staff approval before saving.
- The public page will never show multiple competing primary actions. If no CTA is configured, omit the section rather than inventing a destination.

### 5. Related stories
- Add **More Stories Like This** with 3–4 published stories from the same church.
- Rank recommendations from existing AI analysis: shared themes first, then story patterns/category and recency; exclude the current story.
- Preserve each related item’s real format so vertical video, horizontal video, and written stories have different proportions.
- Use a compact grid on desktop and horizontal scrolling with stable card widths on mobile.

## Staff authoring

Add a **Story** editing area to the existing internal content detail screen so authorized church staff can:
- edit the public title, person/family name, summary, category, and format;
- choose or upload the lead image;
- build and reorder story blocks for text, quotes, images, galleries, and clips;
- add captions and accessible image descriptions;
- select a category CTA default or override its headline, sentence, button label, and destination;
- request an AI suggestion, review it, and explicitly accept or discard it;
- preview the public Story page before publishing.

Add organization-level CTA defaults to the Story Library settings area. Staff can define reusable categories such as Marriage, Community, Baptism, Serving, and Prayer without hard-coding destinations into the public page.

## Content model and access

Create a general story model so the page supports video-led, written, and mixed-media stories without requiring a YouTube record:
- `content_stories`: organization, optional source video, title, person/family name, summary, category, format, lead media, publication state, reading time, CTA override, and authoring metadata.
- `content_story_blocks`: ordered text, heading, quote, image, gallery, and video blocks.
- `content_story_cta_defaults`: organization-level category defaults and destinations.

Use explicit grants and row-level access rules:
- anonymous visitors may read only published stories and their public blocks/default CTA data;
- church members may read drafts;
- owners/admins may create, edit, publish, reorder, or remove story content and category defaults;
- service access is granted for recommendation and AI-assistance functions.

Store story imagery in a dedicated public Story Library media bucket with organization/story paths, image-only file rules, and organization-scoped upload/update/delete policies. Public visitors receive read-only image access.

Update the public story lookup to return only the fields needed by the page, plus the resolved CTA and related-story recommendations. Existing public video links remain valid by resolving their linked story or using the safe video fallback.

## Responsive and interaction details
- Desktop uses generous editorial space; vertical media never stretches into a landscape frame.
- Mobile keeps body text readable, horizontal clips at 16:9, vertical clips near full width, a large 44px minimum CTA target, and swipeable related stories.
- Add restrained image reveal and play-state motion with reduced-motion support.
- Keep all colors, borders, overlays, and shadows on the existing semantic Story Library tokens.

## Verification
- Test a horizontal video story, vertical video story, written story with images, and mixed-media story.
- Verify authoring, reordering, image upload, AI suggestion review, category defaults, story override, draft preview, and publication permissions.
- Verify the public page at desktop and mobile widths, including playback, timestamp jumps, missing optional fields, CTA navigation, related-story ranking, unavailable stories, and no overflow or overlapping text.
- Confirm current public video URLs continue to work and unpublished content is not exposed.
