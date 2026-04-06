# WC2026 Visual Design Options

> **Created:** April 2026
> **Stack:** Next.js + Tailwind CSS v4 + shadcn/ui (base-nova style)
> **Direction:** RTL (Hebrew), `dir="rtl"` on `<html>`
> **Current font:** Inter (set in layout.tsx)

---

## Research Summary: Best Practices

### Responsive Bracket Visualization

How ESPN, Superbru, and similar platforms handle mobile brackets:

- **Horizontal swipe with snap-scroll**: The bracket is split into rounds (columns). On mobile, each round is a full-width snap-scrollable panel. Dot indicators below show which round is visible. Users swipe left/right through R32 -> QF -> SF -> Final.
- **Collapsible accordion per round**: Each round collapses to show only the matches for that stage. Expanding a round shows all matchups as a vertical list.
- **Pinch-to-zoom full bracket**: Show the entire bracket as a zoomable SVG/canvas. ESPN uses this as a "view-only" mode with tap-to-edit for individual matches.
- **Best hybrid approach for this project**: Default to **swipe-per-round** on mobile (most natural for touch), with a "full bracket view" toggle that shows a pinch-to-zoom overview. On desktop, show the full bracket tree horizontally.

### RTL with Tailwind CSS v4

Tailwind v4 has built-in logical property support. Key utilities:

| Physical | Logical (use these) | Effect in RTL |
|----------|---------------------|---------------|
| `ml-4` | `ms-4` | margin on the start side (right in RTL) |
| `mr-4` | `me-4` | margin on the end side (left in RTL) |
| `pl-4` | `ps-4` | padding-inline-start |
| `pr-4` | `pe-4` | padding-inline-end |
| `left-0` | `start-0` | inset-inline-start |
| `right-0` | `end-0` | inset-inline-end |
| `text-left` | `text-start` | text-align: start |
| `text-right` | `text-end` | text-align: end |
| `rounded-l-lg` | `rounded-s-lg` | border-start-radius |
| `rounded-r-lg` | `rounded-e-lg` | border-end-radius |
| `border-l` | `border-s` | border-inline-start |
| `border-r` | `border-e` | border-inline-end |

**Rules for this project:**
1. NEVER use `ml/mr/pl/pr/left/right/rounded-l/rounded-r` -- always use logical equivalents
2. Use `gap` instead of margins between flex/grid children when possible
3. The bracket tree flows **left-to-right** even in RTL (since it represents a tournament flow), so the bracket container should use `dir="ltr"` override while keeping Hebrew text inside it RTL
4. Tailwind v4 container queries: use `@container` and `@min-[size]:` / `@max-[size]:` for component-level responsiveness

### Touch-Friendly Score Input

- Minimum touch target: 44x44px (Apple HIG) / 48x48dp (Material)
- Score input options ranked by usability:
  1. **Stepper buttons** (+/- buttons flanking a number): Best for scores 0-9. Large tap targets, instant feedback, no keyboard needed
  2. **Number pad overlay**: Good for exact score entry. Show a custom 0-9 grid overlay
  3. **Native number input**: Worst option -- small, inconsistent across browsers
- **Recommended**: Stepper with large +/- buttons (48px), the score number centered between them, with haptic feedback on tap
- For group stage drag-and-drop: use `@dnd-kit` with `useSortable`. Ensure drag handles are large (full row grip) and provide visual lift feedback (shadow + scale)

### Leaderboard Design for Small Groups (10-15 friends)

- Show ALL participants (no pagination needed for 10-15 people)
- Highlight top 3 with visual distinction (medal colors / crown icons)
- Show current user's row with a distinct background color
- Display rank change indicators (up/down arrows with delta)
- Show point breakdown on tap/click (expandable row)
- For 10-15 people, a single scrollable list works perfectly -- no tabs needed

---

## Option A: "Stadium Light" -- Clean & Minimal

### 1. Name & Concept
**Stadium Light** -- Apple/Google-inspired minimalism meets the clean lines of a modern stadium. Generous whitespace, subtle depth, and precise typography let the data breathe. Feels like a premium sports analytics dashboard.

### 2. Color Palette

| Role | Hex | Tailwind Variable | Description |
|------|-----|-------------------|-------------|
| Background | `#F8F9FB` | `--background` | Very light blue-gray, avoids pure white glare |
| Card | `#FFFFFF` | `--card` | Pure white cards floating on background |
| Primary | `#1A1A2E` | `--primary` | Deep navy-black for strong text and buttons |
| Secondary | `#E8EDF2` | `--secondary` | Soft cool gray for secondary surfaces |
| Accent | `#3B82F6` | `--accent` | Clean blue (action buttons, active states) |
| Success | `#22C55E` | `--success` | Green for correct predictions, wins |
| Danger | `#EF4444` | `--destructive` | Red for errors, losses, validation warnings |
| Text Primary | `#111827` | `--foreground` | Near-black |
| Text Secondary | `#6B7280` | `--muted-foreground` | Medium gray for labels |

**Additional accent colors:**
- Draw/tie: `#F59E0B` (amber)
- Gold (1st place): `#F59E0B`
- Silver (2nd place): `#94A3B8`
- Bronze (3rd place): `#D97706`

### 3. Typography

| Role | Font | Weight | Size (mobile / desktop) |
|------|------|--------|------------------------|
| Heading (Hebrew) | **Heebo** | 700 (Bold) | 24px / 32px |
| Subheading | **Heebo** | 600 (SemiBold) | 18px / 22px |
| Body | **Heebo** | 400 (Regular) | 14px / 16px |
| Score numbers | **Inter** | 700 (Bold) | 28px / 36px |
| Small labels | **Heebo** | 500 (Medium) | 12px / 13px |

**Why Heebo**: Cleanest Hebrew sans-serif on Google Fonts. Excellent readability at all sizes, 9 weights available. Pairs naturally with Inter for Latin numerals.

**Font loading in layout.tsx:**
```tsx
import { Heebo, Inter } from "next/font/google";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// On <html>: className={`${heebo.variable} ${inter.variable}`}
// In CSS: --font-sans: var(--font-heebo); --font-mono: var(--font-inter);
```

### 4. Card Style

```
Border radius: 12px (rounded-xl)
Shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
  -> Tailwind: shadow-sm
Border: 1px solid #E5E7EB (border border-gray-200)
Background: white
Hover: shadow-md transition-shadow duration-200
```

**Tailwind classes for a standard card:**
```
bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow
```

**Group stage table card:**
```
bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden
```

### 5. Mobile Approach (< 768px)

**Group Stage:**
- Each group is a full-width card with the group letter as a header badge
- Table shows: rank position (numbered), flag + team name, Pts, GD, W-D-L
- Drag handle is the full row -- long-press to pick up, reorder with visual gap indicator
- Match scores below the table in a 2-column grid (3 rows for 6 matches)
- Score input: stepper buttons (+/-) flanking the score number

**Knockout Bracket:**
- **Swipe-per-round navigation**: Each round is a snap-scrollable panel
- Bottom dot indicators + round label ("Round of 32", "Quarter Finals", etc.)
- Each matchup is a card showing two teams stacked vertically with score inputs
- Connector lines hidden on mobile; round progression implied by swipe order

**Daily Predictions:**
- Vertical list of today's match cards
- Each card: two teams with flags, score steppers, time/date, submit button
- Cards sorted by match time

**Leaderboard:**
- Full-width list, all 10-15 members visible without scroll
- Top 3 have a subtle gold/silver/bronze left border accent
- Current user's row has `bg-blue-50` highlight

**Navigation:**
- Bottom tab bar with 4 tabs: Bracket, Predictions, Live, Leaderboard
- Icons from Lucide: `Trophy`, `Target`, `Radio`, `Medal`

```
// Bottom nav bar
<nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 
  flex justify-around items-center h-16 pb-safe z-50">
```

**Specific mobile Tailwind classes:**
```
// Page container
<div className="min-h-screen bg-[#F8F9FB] pb-20">

// Group card
<div className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

// Group header
<div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
  <h3 className="text-lg font-bold text-gray-900">בית A</h3>
</div>

// Table row (draggable)
<div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 
  active:bg-blue-50 touch-manipulation">

// Score stepper
<div className="flex items-center gap-0 rounded-lg border border-gray-200 overflow-hidden">
  <button className="w-11 h-11 flex items-center justify-center bg-gray-50 
    active:bg-gray-200 text-lg font-bold touch-manipulation">-</button>
  <span className="w-10 h-11 flex items-center justify-center font-inter 
    font-bold text-xl tabular-nums">2</span>
  <button className="w-11 h-11 flex items-center justify-center bg-gray-50 
    active:bg-gray-200 text-lg font-bold touch-manipulation">+</button>
</div>
```

### 6. Desktop Approach (>= 1024px)

**Group Stage:**
- 3-column grid of group cards (4 groups per row, 3 rows for 12 groups)
- Or 2-column: left side = group table with drag-and-drop, right side = match score entry form
- `grid grid-cols-3 gap-6` with `max-w-7xl mx-auto`

**Knockout Bracket:**
- Full horizontal bracket tree visible
- Uses CSS Grid with columns per round: R32 (16 rows) -> QF (8 rows) -> SF (4 rows) -> Final (2 rows) -> Winner (1 row)
- Connector lines drawn with CSS borders (vertical + horizontal segments)
- Container has `dir="ltr"` override; team names inside matchups keep `dir="rtl"`

```
// Desktop bracket grid
<div dir="ltr" className="grid grid-cols-[200px_200px_200px_200px_200px_200px_200px] 
  gap-x-8 overflow-x-auto px-8 py-6">
```

**Daily Predictions:**
- 2-column or 3-column grid of match prediction cards
- `grid grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto`

**Leaderboard:**
- Centered card with max-width, full table with columns: Rank, Name, Avatar, Points, Last Round Points, Trend
- `max-w-2xl mx-auto`

**Navigation:**
- Horizontal top nav bar with tabs
- Logo on the right (RTL start), nav tabs center, user avatar on the left (RTL end)

```
// Top nav
<header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
  <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
```

### 7. Key Visual Differentiator
Extreme restraint and whitespace. No gradients, no decorative elements. The focus is entirely on data clarity. Cards float on the light background with minimal shadows. Color is used sparingly -- only for interactive elements and status indicators. Feels like a premium Apple/Google product.

### 8. Match Score Display

```
// Match card (predictions)
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
  <div className="flex items-center justify-between">
    <!-- Home team -->
    <div className="flex items-center gap-3">
      <img src="/flags/br.svg" className="w-8 h-8 rounded-full" />
      <span className="font-semibold text-sm">ברזיל</span>
    </div>
    
    <!-- Score -->
    <div className="flex items-center gap-2">
      <ScoreStepper value={2} />   <!-- +/- stepper -->
      <span className="text-gray-300 font-light text-2xl">:</span>
      <ScoreStepper value={1} />
    </div>
    
    <!-- Away team -->
    <div className="flex items-center gap-3">
      <span className="font-semibold text-sm">ארגנטינה</span>
      <img src="/flags/ar.svg" className="w-8 h-8 rounded-full" />
    </div>
  </div>
  
  <!-- Match info -->
  <div className="mt-2 text-center text-xs text-gray-400">
    שלב הבתים - בית C | 15 ביוני, 21:00
  </div>
</div>
```

**Live match score display:**
- Pulsing red dot next to "LIVE" indicator
- Score in large bold Inter numerals (`text-3xl font-bold font-inter tabular-nums`)
- Minute ticker: `45'+2`
- Green flash animation on goal: `animate-pulse bg-green-50` on the scoring team's side

### 9. Leaderboard Style

```
// Leaderboard container
<div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

  // Header
  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
    <h2 className="text-lg font-bold">טבלת דירוג</h2>
  </div>

  // Row (current user highlighted)
  <div className="flex items-center px-4 py-3 border-b border-gray-50 bg-blue-50/50">
    <span className="w-8 text-center font-bold text-sm text-gray-500">4</span>
    <img src="/avatars/user.jpg" className="w-9 h-9 rounded-full ms-3" />
    <div className="ms-3 flex-1">
      <span className="font-semibold text-sm">אמיר</span>
      <span className="text-xs text-gray-400 ms-2">+12 היום</span>
    </div>
    <span className="font-bold text-lg font-inter tabular-nums">187</span>
    <span className="ms-2 text-green-500 text-xs">▲2</span>
  </div>

  // Top 3 rows get medal icons
  // Rank 1: <span className="text-amber-500">🥇</span>  (or Lucide Trophy icon)
  // Rank 2: <span className="text-gray-400">🥈</span>
  // Rank 3: <span className="text-amber-700">🥉</span>
</div>
```

### 10. Tailwind CSS Classes Reference

```css
/* globals.css additions for Option A */
@theme inline {
  --color-stadium-bg: #F8F9FB;
  --color-stadium-card: #FFFFFF;
  --color-stadium-primary: #1A1A2E;
  --color-stadium-accent: #3B82F6;
  --color-stadium-success: #22C55E;
  --color-stadium-danger: #EF4444;
  --color-stadium-draw: #F59E0B;
  --color-stadium-gold: #F59E0B;
  --color-stadium-silver: #94A3B8;
  --color-stadium-bronze: #D97706;
}
```

---

## Option B: "Matchday" -- Bold & Sporty

### 1. Name & Concept
**Matchday** -- Electric energy inspired by stadium floodlights and broadcast graphics. Bold geometric shapes, vibrant accent colors, and dynamic micro-animations. Feels like tuning into a live sports broadcast on your phone.

### 2. Color Palette

| Role | Hex | Tailwind Variable | Description |
|------|-----|-------------------|-------------|
| Background | `#F0F2F5` | `--background` | Light warm gray |
| Card | `#FFFFFF` | `--card` | White with colored top borders |
| Primary | `#0F172A` | `--primary` | Slate 900 - deep dark blue |
| Secondary | `#1E40AF` | `--secondary` | Bold royal blue (like FIFA branding) |
| Accent | `#F97316` | `--accent` | Energetic orange (highlights, CTAs) |
| Success | `#10B981` | `--success` | Emerald green for correct predictions |
| Danger | `#DC2626` | `--destructive` | Strong red for misses |
| Text Primary | `#0F172A` | `--foreground` | Slate 900 |
| Text Secondary | `#64748B` | `--muted-foreground` | Slate 500 |

**Additional accent colors:**
- Live indicator: `#EF4444` (red pulse)
- Draw/tie: `#EAB308` (yellow)
- Gold (1st): `#FBBF24`
- Silver (2nd): `#CBD5E1`
- Bronze (3rd): `#F59E0B`
- Group header gradient: `linear-gradient(135deg, #1E40AF, #3B82F6)`

### 3. Typography

| Role | Font | Weight | Size (mobile / desktop) |
|------|------|--------|------------------------|
| Heading (Hebrew) | **Rubik** | 700 (Bold) | 22px / 30px |
| Subheading | **Rubik** | 600 (SemiBold) | 16px / 20px |
| Body | **Rubik** | 400 (Regular) | 14px / 16px |
| Score numbers | **Inter** | 800 (ExtraBold) | 32px / 40px |
| Small labels | **Rubik** | 500 (Medium) | 11px / 13px |
| LIVE badge | **Inter** | 700 | 10px (uppercase, tracking-wider) |

**Why Rubik**: Rounded corners give it a friendly sporty feel. Excellent Hebrew support. The geometric character matches broadcast sports graphics. Slightly bolder personality than Heebo.

**Font loading:**
```tsx
import { Rubik, Inter } from "next/font/google";

const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
```

### 4. Card Style

```
Border radius: 8px (rounded-lg)
Shadow: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)
  -> Tailwind: shadow-md
Border: none (shadows only) OR 3px top border in accent color
Background: white
Active state: scale(0.98) + shadow-lg
```

**Tailwind classes for cards:**
```
// Standard card
bg-white rounded-lg shadow-md

// Card with colored top accent
bg-white rounded-lg shadow-md border-t-[3px] border-t-blue-700

// Match card (active/today)
bg-white rounded-lg shadow-md border-t-[3px] border-t-orange-500
  hover:shadow-lg transition-all active:scale-[0.98]
```

### 5. Mobile Approach (< 768px)

**Group Stage:**
- Full-width cards with bold colored header bar (group letter in white on blue gradient)
- Table with alternating row backgrounds (`even:bg-slate-50`)
- Drag-and-drop: grab handle icon on the right side (start in RTL), long-press activates
- Match scores in a compact grid below the table
- Score input: large circular +/- buttons in orange accent color

**Header for group card:**
```
<div className="bg-gradient-to-l from-blue-800 to-blue-600 px-4 py-2.5 
  flex items-center justify-between">
  <h3 className="text-white font-bold text-lg">בית A</h3>
  <span className="text-blue-200 text-xs">6 משחקים</span>
</div>
```

**Knockout Bracket:**
- **Tab navigation per round** (not swipe): Horizontal scrollable tab bar at top
  - Tabs: שמינית | רבע | חצי | גמר
- Each tab shows a vertical list of matchups for that round
- Matchups use a "versus" layout with team flags prominently displayed
- Winning team has an orange left-border highlight after selection

**Daily Predictions:**
- Cards with prominent countdown timer ("ננעל בעוד 2:34:12")
- Match importance badge (group / knockout round) in colored pill
- Score steppers with orange accent buttons

**Leaderboard:**
- Top 3 shown in a special "podium" card at the top (visual podium with 1st elevated)
- Remaining participants in a standard list below
- Movement arrows are large and colored (green up, red down)

**Navigation:**
- Bottom bar with bold icon labels
- Active tab has orange underline + filled icon
- Tab bar has a subtle top shadow

```
// Bottom nav
<nav className="fixed bottom-0 inset-x-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.08)] 
  flex justify-around items-center h-16 pb-safe z-50">
  
  // Active tab
  <div className="flex flex-col items-center gap-0.5">
    <Trophy className="w-6 h-6 text-orange-500" fill="currentColor" />
    <span className="text-[10px] font-medium text-orange-500">עץ</span>
    <div className="w-6 h-0.5 bg-orange-500 rounded-full mt-0.5" />
  </div>
```

### 6. Desktop Approach (>= 1024px)

**Group Stage:**
- 4-column grid (`grid grid-cols-4 gap-4`) showing all 12 groups compactly
- Or "stadium view": 2-column layout with the group table on the right and match editor on the left
- Each group card has the blue gradient header

**Knockout Bracket:**
- Full horizontal tree with animated connector lines
- Matchup cards are compact (180px wide)
- Winning team highlighted with orange background pill
- Connector lines use `border-blue-300` with rounded corners
- Optional: subtle diagonal stripe pattern in the background (like a pitch)

```
// Bracket matchup card
<div className="bg-white rounded-lg shadow-md w-[180px] overflow-hidden">
  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100
    hover:bg-orange-50 cursor-pointer transition-colors">
    <img src="/flags/br.svg" className="w-5 h-5 rounded-sm" />
    <span className="flex-1 text-sm font-medium truncate">ברזיל</span>
    <span className="font-inter font-extrabold text-lg tabular-nums">2</span>
  </div>
  <div className="flex items-center gap-2 px-3 py-2 
    hover:bg-orange-50 cursor-pointer transition-colors">
    <img src="/flags/ar.svg" className="w-5 h-5 rounded-sm" />
    <span className="flex-1 text-sm font-medium truncate">ארגנטינה</span>
    <span className="font-inter font-extrabold text-lg tabular-nums">1</span>
  </div>
</div>
```

**Navigation:**
- Top bar with blue gradient background
- Logo + tournament name on the right (start)
- Nav links center, styled as pills
- Active pill: white text on orange background

```
// Desktop nav
<header className="sticky top-0 z-50 bg-gradient-to-l from-blue-900 to-blue-700">
  <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6">
    <h1 className="text-white font-bold text-lg">מונדיאל 2026</h1>
    <nav className="flex items-center gap-1">
      <a className="px-4 py-1.5 rounded-full text-sm font-medium 
        bg-orange-500 text-white">עץ טורניר</a>
      <a className="px-4 py-1.5 rounded-full text-sm font-medium 
        text-blue-100 hover:bg-white/10">ניחושים</a>
    </nav>
  </div>
</header>
```

### 7. Key Visual Differentiator
**Colored accent borders and gradient headers** give each section energy. The blue-to-orange color story is unmistakably sporty. Cards have a physical, tactile feel with stronger shadows. The tab-based round navigation on mobile feels like switching between broadcast camera angles. Micro-animations (scale on tap, slide transitions between rounds) add dynamism.

### 8. Match Score Display

```
// Match card -- "broadcast style"
<div className="bg-white rounded-lg shadow-md overflow-hidden">
  <!-- Match header -->
  <div className="bg-slate-900 px-4 py-1.5 flex items-center justify-between">
    <span className="text-slate-400 text-xs">בית C - סיבוב 2</span>
    <span className="text-slate-400 text-xs">15.06 | 21:00</span>
  </div>
  
  <!-- Score area -->
  <div className="px-4 py-4 flex items-center justify-between">
    <!-- Home -->
    <div className="flex flex-col items-center gap-1.5 w-24">
      <img src="/flags/br.svg" className="w-10 h-10 rounded-md shadow-sm" />
      <span className="font-semibold text-sm text-center">ברזיל</span>
    </div>
    
    <!-- Score (big and bold) -->
    <div className="flex items-center gap-3">
      <span className="font-inter font-extrabold text-4xl tabular-nums text-slate-900">2</span>
      <span className="text-slate-300 font-light text-2xl">-</span>
      <span className="font-inter font-extrabold text-4xl tabular-nums text-slate-900">1</span>
    </div>
    
    <!-- Away -->
    <div className="flex flex-col items-center gap-1.5 w-24">
      <img src="/flags/ar.svg" className="w-10 h-10 rounded-md shadow-sm" />
      <span className="font-semibold text-sm text-center">ארגנטינה</span>
    </div>
  </div>
</div>
```

**Score input (edit mode):**
- Large orange circular +/- buttons (48px diameter)
- Score number in center with `text-4xl font-extrabold`
- Buttons: `w-12 h-12 rounded-full bg-orange-500 text-white font-bold text-xl shadow-md active:scale-90`

### 9. Leaderboard Style

**Mobile podium:**
```
// Top 3 podium visualization
<div className="flex items-end justify-center gap-3 px-4 pt-4 pb-6">
  <!-- 2nd place -->
  <div className="flex flex-col items-center">
    <img className="w-12 h-12 rounded-full border-2 border-slate-300" />
    <span className="text-sm font-bold mt-1">דני</span>
    <div className="bg-slate-200 rounded-t-lg w-20 h-16 mt-2 flex items-center justify-center">
      <span className="font-inter font-extrabold text-xl">156</span>
    </div>
  </div>
  
  <!-- 1st place (tallest) -->
  <div className="flex flex-col items-center">
    <div className="text-amber-400 mb-1"><Crown className="w-6 h-6" /></div>
    <img className="w-14 h-14 rounded-full border-2 border-amber-400 shadow-lg" />
    <span className="text-sm font-bold mt-1">יוסי</span>
    <div className="bg-gradient-to-t from-amber-200 to-amber-100 rounded-t-lg 
      w-20 h-24 mt-2 flex items-center justify-center">
      <span className="font-inter font-extrabold text-2xl">187</span>
    </div>
  </div>
  
  <!-- 3rd place -->
  <div className="flex flex-col items-center">
    <img className="w-12 h-12 rounded-full border-2 border-amber-600" />
    <span className="text-sm font-bold mt-1">רון</span>
    <div className="bg-amber-100 rounded-t-lg w-20 h-12 mt-2 flex items-center justify-center">
      <span className="font-inter font-extrabold text-xl">142</span>
    </div>
  </div>
</div>
```

**Remaining rows:**
```
<div className="flex items-center px-4 py-3 border-b border-gray-100">
  <span className="w-7 text-center font-bold text-sm text-slate-400">4</span>
  <img className="w-8 h-8 rounded-full ms-3" />
  <span className="ms-3 flex-1 font-semibold text-sm">אמיר</span>
  <div className="flex items-center gap-2">
    <span className="text-green-500 text-xs font-medium">▲2</span>
    <span className="font-inter font-bold text-lg tabular-nums">135</span>
  </div>
</div>
```

### 10. Tailwind CSS Classes Reference

```css
/* globals.css additions for Option B */
@theme inline {
  --color-matchday-bg: #F0F2F5;
  --color-matchday-blue: #1E40AF;
  --color-matchday-blue-light: #3B82F6;
  --color-matchday-orange: #F97316;
  --color-matchday-dark: #0F172A;
  --color-matchday-success: #10B981;
  --color-matchday-danger: #DC2626;
  --color-matchday-gold: #FBBF24;
  --color-matchday-silver: #CBD5E1;
  --color-matchday-bronze: #F59E0B;
  --color-matchday-live: #EF4444;
}
```

---

## Option C: "Golden Boot" -- Premium & Sophisticated

### 1. Name & Concept
**Golden Boot** -- Luxury fintech meets championship prestige. Inspired by high-end financial dashboards and premium membership clubs. Dark accents on light backgrounds, gold highlights, muted tones, and refined micro-interactions. Feels like managing an exclusive investment portfolio of football predictions.

### 2. Color Palette

| Role | Hex | Tailwind Variable | Description |
|------|-----|-------------------|-------------|
| Background | `#FAFAF8` | `--background` | Warm off-white with ivory undertone |
| Card | `#FFFFFF` | `--card` | Clean white |
| Primary | `#18181B` | `--primary` | Zinc 900 - rich black |
| Secondary | `#F4F4F5` | `--secondary` | Zinc 100 - warm light gray |
| Accent | `#B8860B` | `--accent` | Dark goldenrod - luxurious gold |
| Success | `#16A34A` | `--success` | Rich green (profit/correct) |
| Danger | `#B91C1C` | `--destructive` | Deep red (loss/incorrect) |
| Text Primary | `#18181B` | `--foreground` | Zinc 900 |
| Text Secondary | `#71717A` | `--muted-foreground` | Zinc 500 |

**Additional accent colors:**
- Accent light: `#D4A843` (lighter gold for backgrounds)
- Accent surface: `#FBF7EE` (very light gold wash)
- Rank 1 border: `#B8860B` (dark gold)
- Rank 2 border: `#A1A1AA` (zinc 400)
- Rank 3 border: `#92400E` (amber 800)
- Positive delta: `#16A34A`
- Negative delta: `#B91C1C`

### 3. Typography

| Role | Font | Weight | Size (mobile / desktop) |
|------|------|--------|------------------------|
| Heading (Hebrew) | **Heebo** | 600 (SemiBold) | 22px / 28px |
| Subheading | **Heebo** | 500 (Medium) | 16px / 20px |
| Body | **Heebo** | 400 (Regular) | 14px / 15px |
| Score numbers | **Inter** | 600 (SemiBold) | 24px / 32px |
| Small labels | **Heebo** | 400 (Regular) | 11px / 12px |
| Stat labels | **Inter** | 500 (Medium) | 11px (uppercase, tracking-widest) |

**Why Heebo at lighter weights**: Using SemiBold instead of Bold for headings gives a more refined, less aggressive feel. The thinner strokes convey sophistication. Uppercase Inter for stat labels mimics the financial dashboard aesthetic.

**Font loading:**
```tsx
import { Heebo, Inter } from "next/font/google";

const heebo = Heebo({ 
  subsets: ["hebrew", "latin"], 
  variable: "--font-heebo",
  weight: ["400", "500", "600"]  // No bold needed
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
```

### 4. Card Style

```
Border radius: 16px (rounded-2xl)
Shadow: none -- borders only
Border: 1px solid #E4E4E7 (zinc-200)
Background: white
Hover: border-color transitions to gold accent
Special: some cards have a thin gold top border (1px)
```

**Tailwind classes for cards:**
```
// Standard card
bg-white rounded-2xl border border-zinc-200

// Premium card (with gold accent)
bg-white rounded-2xl border border-zinc-200 border-t-[2px] border-t-[#B8860B]

// Hover state
hover:border-[#D4A843] transition-colors duration-300

// Active/selected card
bg-white rounded-2xl border-2 border-[#B8860B] ring-1 ring-[#B8860B]/20
```

### 5. Mobile Approach (< 768px)

**Group Stage:**
- Clean cards with a single thin gold line at top
- Group letter shown as a small, refined badge (`text-xs tracking-widest uppercase`)
- Table is minimal: no row backgrounds, just thin separators
- Team rows show flag, name, and key stats in a clean horizontal layout
- Drag indicator: subtle 3-dot grip icon (not a full-row handle)
- Match score entry below table in a grid with thin borders between cells

**Match score input:**
```
// Refined stepper -- no buttons visible, tap zones implied
<div className="flex items-center">
  <button className="w-10 h-10 flex items-center justify-center 
    text-zinc-300 hover:text-[#B8860B] transition-colors touch-manipulation">
    <Minus className="w-4 h-4" />
  </button>
  <span className="w-8 text-center font-inter font-semibold text-xl tabular-nums">2</span>
  <button className="w-10 h-10 flex items-center justify-center 
    text-zinc-300 hover:text-[#B8860B] transition-colors touch-manipulation">
    <Plus className="w-4 h-4" />
  </button>
</div>
```

**Knockout Bracket:**
- **Vertical flow per round** with elegant transitions
- Round selector as a segmented control at top (pill-style tabs)
- Active segment has gold background: `bg-[#B8860B] text-white`
- Matchup cards stacked vertically with refined connector dots between rounds
- Winning team name turns gold

**Daily Predictions:**
- Cards with a "portfolio" feel: each match is like a financial position
- Shows "potential points" as a muted label (`+3 נקודות אפשריות`)
- Lock countdown in a muted timer below the card
- Clean horizontal layout: Team A - Score - Score - Team B

**Leaderboard:**
- Elegant numbered list with no podium gimmick
- Top 3 have a thin gold/silver/bronze left border
- Points shown with a small sparkline chart next to them (showing trend)
- Current user row: `bg-[#FBF7EE]` (warm gold tint)

**Navigation:**
- Bottom tab bar, ultra-minimal
- Just icons (no labels) with a gold dot indicator for active tab
- Active icon color: `#B8860B`

```
// Bottom nav - minimal
<nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-lg 
  border-t border-zinc-100 flex justify-around items-center h-14 pb-safe z-50">
  
  // Active tab
  <div className="flex flex-col items-center gap-1">
    <Trophy className="w-5 h-5 text-[#B8860B]" />
    <div className="w-1 h-1 rounded-full bg-[#B8860B]" />
  </div>
  
  // Inactive tab
  <div className="flex flex-col items-center gap-1">
    <Target className="w-5 h-5 text-zinc-400" />
  </div>
```

### 6. Desktop Approach (>= 1024px)

**Group Stage:**
- 3-column grid with generous spacing (`gap-8`)
- Each group card: clean white with gold top border accent
- Hover state smoothly changes border to full gold
- Typography is restrained -- no bold headers, just semibold

**Knockout Bracket:**
- Full horizontal tree with thin connecting lines (`border-zinc-300`)
- Matchup cards are compact with refined styling (no shadows, just borders)
- Winning team: name text turns gold, slight background highlight
- The bracket background has a very subtle warm tint (`bg-[#FAFAF8]`)

```
// Bracket matchup
<div className="bg-white rounded-xl border border-zinc-200 w-[190px] overflow-hidden">
  <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-100
    hover:bg-[#FBF7EE] cursor-pointer transition-colors group">
    <img src="/flags/br.svg" className="w-5 h-5 rounded-sm" />
    <span className="flex-1 text-sm font-medium truncate 
      group-hover:text-[#B8860B] transition-colors">ברזיל</span>
    <span className="font-inter font-semibold text-base tabular-nums text-zinc-900">2</span>
  </div>
</div>
```

**Daily Predictions:**
- Single centered column, max-width 640px
- Each match card is a wide horizontal row
- Feels like a list of financial positions/trades

**Navigation:**
- Top horizontal bar, minimal
- Thin bottom border only (no background color)
- Nav items are text-only (no pills/backgrounds), active has gold underline
- Logo: refined wordmark, no icon

```
// Desktop nav - premium minimal
<header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-zinc-100">
  <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-8">
    <span className="font-semibold text-lg tracking-tight">WC2026</span>
    <nav className="flex items-center gap-8">
      <a className="text-sm font-medium text-[#B8860B] border-b-2 
        border-[#B8860B] pb-3.5">עץ טורניר</a>
      <a className="text-sm font-medium text-zinc-500 hover:text-zinc-900 
        transition-colors pb-3.5">ניחושים</a>
      <a className="text-sm font-medium text-zinc-500 hover:text-zinc-900 
        transition-colors pb-3.5">לייב</a>
      <a className="text-sm font-medium text-zinc-500 hover:text-zinc-900 
        transition-colors pb-3.5">דירוג</a>
    </nav>
  </div>
</header>
```

### 7. Key Visual Differentiator
**Restrained luxury through gold accents and generous whitespace.** No gradients, no heavy shadows, no sporty energy. Instead, the design communicates authority and sophistication through typographic hierarchy, gold color accents, and ample breathing room. The warm ivory background (`#FAFAF8`) distinguishes it from cold corporate white. Every interaction feels intentional and precise.

### 8. Match Score Display

```
// Match card -- "portfolio position" style
<div className="bg-white rounded-2xl border border-zinc-200 p-5">
  <!-- Match info (subtle) -->
  <div className="flex items-center justify-between mb-4">
    <span className="text-[11px] font-inter font-medium tracking-widest uppercase 
      text-zinc-400">GROUP C - MD 2</span>
    <span className="text-[11px] text-zinc-400">15.06 | 21:00</span>
  </div>
  
  <!-- Score area -->
  <div className="flex items-center justify-between">
    <!-- Home -->
    <div className="flex items-center gap-3">
      <img src="/flags/br.svg" className="w-8 h-8 rounded-md" />
      <span className="font-medium text-[15px]">ברזיל</span>
    </div>
    
    <!-- Score -->
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50 rounded-xl">
      <span className="font-inter font-semibold text-2xl tabular-nums">2</span>
      <span className="text-zinc-300">:</span>
      <span className="font-inter font-semibold text-2xl tabular-nums">1</span>
    </div>
    
    <!-- Away -->
    <div className="flex items-center gap-3">
      <span className="font-medium text-[15px]">ארגנטינה</span>
      <img src="/flags/ar.svg" className="w-8 h-8 rounded-md" />
    </div>
  </div>
  
  <!-- Points potential -->
  <div className="mt-3 text-center">
    <span className="text-xs text-zinc-400">+3 נקודות אפשריות</span>
  </div>
</div>
```

**Live match:**
- No pulsing animations -- instead, a refined "LIVE" pill in red (`bg-red-700 text-white text-[10px] tracking-wider px-2 py-0.5 rounded-full`)
- Score updates with a subtle fade-in transition (`transition-opacity duration-500`)
- Goal event shown as a small gold flash on the score number

### 9. Leaderboard Style

```
// Leaderboard -- premium list
<div className="max-w-xl mx-auto bg-white rounded-2xl border border-zinc-200 overflow-hidden">

  // Header
  <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
    <h2 className="font-semibold text-lg">טבלת דירוג</h2>
    <span className="text-xs text-zinc-400 font-inter tracking-wider uppercase">
      15 PLAYERS
    </span>
  </div>

  // Top row (1st place with gold accent)
  <div className="flex items-center px-5 py-3.5 border-b border-zinc-50 
    border-s-[3px] border-s-[#B8860B]">
    <span className="w-6 font-inter font-semibold text-sm text-[#B8860B]">1</span>
    <img className="w-8 h-8 rounded-full ms-3 ring-2 ring-[#B8860B]/30" />
    <div className="ms-3 flex-1">
      <span className="font-medium text-sm">יוסי</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-inter text-green-600 font-medium">+12</span>
      <span className="font-inter font-semibold text-base tabular-nums">187</span>
    </div>
  </div>

  // 2nd place (silver accent)
  <div className="... border-s-[3px] border-s-zinc-400">...</div>

  // 3rd place (bronze accent)
  <div className="... border-s-[3px] border-s-amber-700">...</div>

  // Regular row
  <div className="flex items-center px-5 py-3.5 border-b border-zinc-50">
    <span className="w-6 font-inter font-semibold text-sm text-zinc-400">4</span>
    <img className="w-8 h-8 rounded-full ms-3" />
    <div className="ms-3 flex-1">
      <span className="font-medium text-sm">אמיר</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-inter text-red-600 font-medium">-1</span>
      <span className="font-inter font-semibold text-base tabular-nums">135</span>
    </div>
  </div>

  // Current user highlight
  <div className="... bg-[#FBF7EE]">...</div>
</div>
```

### 10. Tailwind CSS Classes Reference

```css
/* globals.css additions for Option C */
@theme inline {
  --color-golden-bg: #FAFAF8;
  --color-golden-card: #FFFFFF;
  --color-golden-primary: #18181B;
  --color-golden-accent: #B8860B;
  --color-golden-accent-light: #D4A843;
  --color-golden-accent-surface: #FBF7EE;
  --color-golden-success: #16A34A;
  --color-golden-danger: #B91C1C;
  --color-golden-muted: #71717A;
  --color-golden-border: #E4E4E7;
}
```

---

## Comparison Matrix

| Feature | A: Stadium Light | B: Matchday | C: Golden Boot |
|---------|-----------------|-------------|----------------|
| **Personality** | Calm, data-focused | Energetic, broadcast | Refined, prestigious |
| **Background** | `#F8F9FB` cool gray | `#F0F2F5` warm gray | `#FAFAF8` warm ivory |
| **Primary accent** | Blue `#3B82F6` | Orange `#F97316` | Gold `#B8860B` |
| **Hebrew font** | Heebo Bold | Rubik Bold | Heebo SemiBold |
| **Card radius** | 12px (rounded-xl) | 8px (rounded-lg) | 16px (rounded-2xl) |
| **Card depth** | Light shadow + border | Medium shadow, no border | No shadow, border only |
| **Mobile bracket** | Swipe-per-round | Tab navigation | Segmented control |
| **Score font size** | 28px mobile | 32px mobile | 24px mobile |
| **Leaderboard** | Simple list | Podium + list | Elegant list + sparklines |
| **Navigation feel** | iOS-like tabs | Broadcast ticker | Minimal icons only |
| **Animation level** | Subtle (shadow transitions) | Dynamic (scale, slide) | Minimal (fade, color) |
| **Best for** | Clarity & usability | Fun & engagement | Sophistication & style |

---

## Shared Implementation Notes

### RTL Bracket Direction Override

The knockout bracket tree should flow left-to-right regardless of RTL:

```tsx
// BracketContainer.tsx
<div dir="ltr" className="overflow-x-auto">
  {/* Bracket rounds flow left to right */}
  <div className="flex gap-8 min-w-max p-6">
    {rounds.map(round => (
      <div key={round.id} className="flex flex-col gap-4 justify-around">
        {round.matches.map(match => (
          // Team names inside are still RTL
          <MatchCard key={match.id} dir="rtl" match={match} />
        ))}
      </div>
    ))}
  </div>
</div>
```

### Score Stepper Component (shared)

```tsx
// components/shared/ScoreStepper.tsx
interface ScoreStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

// Tailwind classes adapt per theme via CSS variables
// Minimum 44px touch targets on all buttons
// tabular-nums on the score display for alignment
// touch-manipulation on buttons to prevent 300ms delay
```

### Container Queries for Responsive Cards

```tsx
// A match card that adapts to its container, not the viewport
<div className="@container">
  <div className="flex flex-col @[400px]:flex-row items-center gap-4">
    {/* Vertical stack in narrow containers, horizontal in wide */}
  </div>
</div>
```

### Drag-and-Drop Touch Optimization

```tsx
// For @dnd-kit on mobile:
// 1. Use activationConstraint with distance: 8 to prevent accidental drags
// 2. Add touch-action: none on draggable elements
// 3. Use large drag handles (full row width)
// 4. Provide visual lift feedback: shadow-lg + scale-[1.02] + opacity-90

<SortableContext items={teams}>
  {teams.map(team => (
    <SortableTeamRow 
      key={team.id} 
      team={team}
      className="touch-none active:shadow-lg active:scale-[1.02] 
        active:opacity-90 transition-all duration-150"
    />
  ))}
</SortableContext>
```

### Performance Notes

- **Font loading**: Use `next/font` with `display: swap` (default). Only load needed weights.
  - Option A: Heebo 400,500,600,700 + Inter 700 = ~120KB
  - Option B: Rubik 400,500,600,700 + Inter 700,800 = ~130KB
  - Option C: Heebo 400,500,600 + Inter 500,600 = ~100KB
- **Flag images**: Use SVG flags (small file size), lazy-load with `loading="lazy"`
- **Bracket rendering**: Use CSS Grid, not absolute positioning. CSS Grid handles responsive bracket layout better and avoids layout thrashing on resize.

---

## Recommendation

For a group of 10-15 friends, **Option B (Matchday)** is likely the most engaging -- the sporty energy and bold colors create excitement during the tournament. However, if the group values a cleaner, more "app-like" experience, **Option A (Stadium Light)** is the safest choice with proven usability patterns. **Option C (Golden Boot)** is the most distinctive but requires more design discipline to execute well.

All three options are fully compatible with the existing tech stack (Tailwind v4, shadcn/ui base-nova, @dnd-kit, Framer Motion).
