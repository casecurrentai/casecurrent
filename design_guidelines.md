# CaseCurrent Design Guidelines

## Design Philosophy
**Source of Truth**: Match the existing CaseCurrent visual system EXACTLY. This is non-negotiable. Do not invent a new aesthetic.

## Typography System
- **Critical**: Extract exact font families, weights, and sizes from CaseCurrent via DevTools inspection
- Pull the actual font import from the site's CSS
- Apply identical font stack across all marketing pages and mobile app
- Match heading hierarchy, letter-spacing, and weight distribution precisely

## Signature Design Element: Guilloche Underlay
- Subtle decorative linework pattern positioned BEHIND top navigation/app bar only
- Implementation: SVG or CSS background, opacity 3-6%, thin strokes, slightly softened
- Fade out downward using gradient mask
- Must maintain full contrast/legibility of navigation elements
- Static only (no animation), respect prefers-reduced-motion

## Wireframe AI Blueprint Elements
Apply throughout all interfaces as subtle overlays:
- Thin 1px lines, corner brackets, subtle nodes/dots, measurement/connector lines
- Use to outline feature cards, point at key UI blocks (steps, grids, dashboards)
- Extremely light opacity to keep content primary
- Creates a "technical blueprint" aesthetic that reinforces the AI-powered positioning

## Layout & Spacing
- Extract exact values from CaseCurrent: max-width containers, section padding, gutters, card spacing
- Match vertical rhythm, soft shadows, border radii, and line separators
- Maintain consistent spacing system across web and mobile

## Color & UI Tokens
- Derive from CaseCurrent (do not guess): primary brand blue, hover blue, background tints, border colors, text colors
- Implement as CSS variables or Tailwind tokens
- Button styling must match exactly: radius, padding, font weight, shadow, hover states

## Marketing Website Structure

### Global Components
- Navigation with guilloche underlay + CaseCurrent link spacing
- Primary CTA: "Book a Demo" (exact styling match)
- Secondary links: "Sign in" with matching treatment
- Footer: Same column layout and typography hierarchy as existing site

### Required Pages (Preserve Existing Content)
- `/` - Home
- `/solutions` - AI Voice Agent, Smart Qualification, Instant Follow-up grid, CTA
- `/how-it-works` - 3-step flow + timeline + CTA
- `/security` - Trust elements, clean lists
- `/pricing`
- `/resources` + subpages

## Mobile App Design

### App-Wide Standards
- Identical font stack to marketing site
- Same blue/neutral palette tokens
- Matching card style (radius/shadow/border)
- Top app bar with guilloche underlay
- Wireframe/blueprint motifs in dashboard backgrounds (subtle)
- **Critical Fix**: Top bar must NOT overlap rounded corners of cards below; implement proper safe-area padding + vertical spacing

### Navigation
Bottom tab bar (5 tabs): Dashboard | Leads | Calls | Automations | Settings

### Key Screens

**Dashboard**
- "Today" summary cards: Missed calls, New leads, Qualified, Booked consults, Response time
- Clean charts (line/bar) matching website UI style
- "Live Status" pill badges consistent with marketing site

**Leads**
- Strong hierarchy: name, status badge, case type, score, timestamp
- Filter chips: All / New / Qualified / Signed / Disqualified
- Detail screen: score panel, transcript snippet, timeline, action buttons matching "Book a Demo" style

**Calls**
- Call log with icons, duration, transcript availability
- Detail: audio player, transcript, extracted fields, routing outcome
- Action buttons for tasks/follow-ups

**Automations**
- Toggle switches + status indicators
- Integration tiles (webhook/Zapier-style, clean enterprise aesthetic)
- Event logs with timestamps

**Settings**
- Organization profile, team, roles, notifications
- Security section styled like marketing "/security" page

## Quality Standard
Every element must look like it belongs to the CaseCurrent brand family. If anything appears "template-y" or generic, it fails. Users should instantly recognize the app through typography and wireframe motifs alone.