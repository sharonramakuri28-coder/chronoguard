<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All app data comes from Lovable Cloud tables via server functions in `src/lib/chrono.functions.ts` (public read client + admin client for writes). Do not hardcode demo data in components.
- Demo sequences (audit scan, CSV screening) are driven by DB rows plus scripted client phases; MacroAlpha-v4 metrics must be calculated from demo_decisions on all screens (currently +30.3% / +17.4% / 12.9 percentage points, 92 leakage events and 4 risky features). Why: prevent divergent demo statistics.
- Hindsight (real, via `@vectorize-io/hindsight-client`) lives only in `src/lib/hindsight.server.ts` + `hindsight.functions.ts`; it stores lessons, Postgres stores deterministic numbers. Why: never show "Connected"/"Retained" unless the real call succeeded; fall back to local matcher labelled "Demo Memory Fallback".
- Colors: Temporal Aurora tokens in src/styles.css (lavender=Hindsight/correct, apricot=replay/apparent, coral=leak, mint=safe, saffron=warn). Why: single themed source.
