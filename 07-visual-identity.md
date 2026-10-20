# QR-ATT Visual Identity

QR-ATT uses a soft pink-and-purple visual system designed for a polished, readable attendance experience. The UI refresh changes presentation only; Supabase data access, authentication, event creation, attendance validation, and camera scanning remain connected to the existing services.

## Brand palette

The shared tokens live in `constants/colors.ts`.

| Token | Value | Use |
|---|---|---|
| `pink` | `#EC4899` | Brand and accent |
| `deepPink` | `#DB2777` | Strong pink accents |
| `primary` | `#A855F7` | Purple primary accent |
| `deepPurple` | `#7E22CE` | High-emphasis text and actions |
| `background` | `#FDF8FF` | Light application background |
| `card` | `#FFFFFF` | Main card surface |
| `softPink` | `#FCE7F3` | Soft brand surface |
| `lavender` | `#E9D5FF` | Soft purple surface |
| `textPrimary` | `#31213F` | Main text |
| `textSecondary` | `#75677F` | Supporting text |
| `success` | `#16834A` | Successful attendance and open state |
| `danger` | `#DC3545` | Errors |
| `warning` | `#B7791F` | Warnings |

Gradient usage is intentional: headers use pink `#EC4899` to purple `#9333EA`; primary actions use pink `#F472B6` to purple `#A855F7`. QR codes remain black on white with a clear quiet zone.

## Shared UI

- `components/AppButton.tsx` provides gradient primary actions, bordered secondary actions, and disabled/loading support.
- `components/ScreenHeader.tsx` provides the shared gradient header for tab screens.
- `components/Header.tsx` provides the QR mark used on authentication screens.
- `app/(tabs)/_layout.tsx` styles the existing Home, Scan, History, Profile, and Teacher routes with a white bottom navigation bar and purple active state.

Cards use white surfaces, rounded corners, thin lavender borders, and restrained shadows. Status colors remain semantic rather than replacing the brand palette.

## Screen behavior

- **Sign in and registration:** Gradient hero, white form surfaces, readable validation states, password visibility on sign-in, and the existing student/teacher registration options.
- **Home:** Greeting/profile affordance, actual attendance-history count, upcoming events read from Supabase, recent check-ins, and the Scan action.
- **Teacher:** Role-protected event creation, live event/check-in summaries from teacher-owned records, searchable event cards, event QR generation, and the existing attendance history route.
- **Administrator:** Admin-only event creation with unique code/title and start/end time, generated QR display, plus the existing system-wide event listing. Apply the event-insert policy in `supabase/admin-access.sql` first.
- **History and profile:** Existing authorization-aware data sources and profile editing/sign-out behavior with consistent card and empty/loading states.
- **Scanner:** The camera view and QR barcode callback are unchanged in purpose. The interface adds scan guidance, a framing guide, optional torch control, permission guidance, and an attendance result state around the existing validation call.

## Roles and data boundaries

The profile role type supports `student`, `teacher`, and `admin`. Public registration still only offers student/teacher. Administrator access is enforced in the app and by the RLS policies in `supabase/admin-access.sql`; see that script before provisioning an admin account.

Dashboard totals are derived from fetched attendance and event records, not sample values. The administrator screen includes system totals, student/teacher/admin breakdowns, searchable user and event listings, event status, and recent attendance monitoring. It deliberately does not provide unaudited role changes or attendance corrections because the existing database has no audit-log workflow. Venue, draft, and audit data are not fabricated.

## Development checks

```powershell
npx tsc --noEmit
npx expo export --platform web
```

The project uses Expo SDK 54 and `expo-linear-gradient` at its SDK-compatible version. `tsconfig.json` maps the existing `@/` imports to the project root.
