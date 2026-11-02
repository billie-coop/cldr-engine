# Functional rewrite (2.x) — working log

Branch: `functional-rewrite`. Started 2026-11-01 from `main` @ `3f51c5a4` (v1.16.0).

## Summary

The whole library is ported to plain data + exported functions. No classes remain in runtime code
(the `cldr-compiler` build tool still uses some; it is not shipped to browsers).

- **Tests:** 172 files / **1315 tests, all passing** — the 1.x baseline was 170 / 1309. All 1309
  1.x tests run against the new code with their assertions unchanged (three read 1.x private fields
  and now read the public equivalent, see Deviations); 6 tests are new.
- **Lint / types:** `pnpm lint` (tsc for every package incl. tests, benchmarks, stress scripts +
  eslint) is clean. `pnpm build` is clean. API Extractor reports are regenerated.
- **Resource packs:** unchanged format; the packs the compiler builds are byte-identical to 1.x
  (same sha256 for all 204 files). CLDR 48 / tzdb 2025b data untouched; `autogen.zonedata.ts`
  and its `RawData` format are unchanged so the tzdb 2026f update merges cleanly.
- **Tree-shaking** (rollup + terser, `examples/tree-shaking/`), same usage as 1.x, same output:

  | usage | 2.x min+gzip | 1.x min+gzip |
  |---|---|---|
  | load a locale, formatDecimal + formatCurrency | **41.8 KB** (106.9 KB min) | 111.5 KB (363.9 KB min) |
  | load a locale, formatDate | **86.4 KB** (270.8 KB min) | 111.5 KB (364.0 KB min) |
  | Decimal arithmetic only | **2.7 KB** (6.1 KB min) | 5.9 KB (17.4 KB min) |
  | convenience object (everything) | 102.4 KB (316.1 KB min) | — |

  A bundle that uses one trivial export comes out at 30 bytes, so no module has import-time side
  effects. Full UMD bundle of everything: 359 KB vs 384 KB.
- **Differential checks against the 1.x build** (beyond the test suite): decimal and number
  rendering via the suite; timezone ~714k lookups, language-tag/locale/matcher ~325k comparisons,
  plurals/messageformat ~507k cases, unit-converter + rbnf ~830k output lines, calendar dates 620k
  output lines — all identical. Whole locale API: **2.2 million calls across all 429 locales (+40
  extra ids), zero differences** — see "Differential check (locale API)".
- **Performance** (en, node 24, ops/s; see "Performance" below): in an app-style ES-module
  bundle 2.x is at parity or faster — formatDecimal / formatCurrency equal, formatDate from
  `{ date, zoneId }` ~10% faster, formatDate of a prebuilt date within noise. In the CommonJS
  build, formatting a prebuilt date is ~10% slower (re-export getters on cross-package calls).

What's left / rough edges are listed at the end, with the things I wasn't sure about.

## Baseline (1.x on `main`, before any change)

| | |
|---|---|
| `pnpm install` | ok (10s) |
| `pnpm build` | ok (27s) — UMD bundle `dist/cldrengine.umd.js` 384.9 KB min, 116.0 KB gzip, 90.5 KB brotli |
| `vitest --run` | **170 files, 1309 tests, all passing** (10.3s wall) |
| `pnpm lint` (tsc + eslint) | clean (16s) |

Tests per package (files / tests): cldr-core 106/508, plurals 6/349, locale-matcher 3/183,
decimal 15/119, messageformat 6/40, unit-converter 7/27, cldr-compiler 7/21, timezone 5/16,
language-tag 3/13, locale 3/11, cldr 3/11, cldr-utils 5/9, cldr-ext-rbnf 1/2.

A frozen 1.x reference build (detached worktree of `3f51c5a4`) is kept outside the repo for
differential checks and the bundle-size comparison.

## Design conventions

These rules apply to every package. They are what the code review should hold the port to.

### 1. Plain data in, plain data out

- No classes in runtime code. State lives in plain, readonly objects; behaviour lives in exported
  functions that take that data as their first argument.
- Value types (`Decimal`, `Rational`, calendar dates, `LanguageTag`, …) are immutable plain
  objects. Functions never mutate their inputs; they return new values.
- "Engine" objects that 1.x built with `new` (plural rules, locale matcher, message formatter,
  unit converter, time zone database) become plain records created by a `create*`/`get*`
  function, plus functions that take the record.
- Interfaces describe data; there are no methods on data types (no `toString()` either — use the
  explicit `*ToString` function).

### 2. Naming

The aggregate package re-exports everything flat, so names must be unique across the library and
easy to find with autocomplete:

- **Value-type operations are prefixed with the type's short name**:
  `decimalAdd(a, b)`, `decimalCompare(a, b)`, `decimalToString(d)`, `rationalMultiply(a, b)`,
  `dateAdd(d, period)`, `dateYear(d)`, `tagRegion(t)`, `tagCompact(t)`.
  The constructor is the bare short name: `decimal('1.5')`, `rational(1, 3)`, `languageTag(...)`.
- 1.x static methods become plain functions named for what they do
  (`LanguageResolver.resolve` → `resolveLanguageTag`, `GregorianDate.fromUnixEpoch` →
  `gregorianFromUnixEpoch`).
- **Locale functions keep their 1.x method names** and take the locale data first:
  `formatDecimal(locale, n, opts)`, `formatDate(locale, date, opts)`,
  `getCurrencySymbol(locale, code)`. That keeps the docs and the convenience layer 1:1.

### 3. Locale data

- A locale is a plain `LocaleData` object `{ locale, bundle, schema }`: the resolved locale id/tag,
  the plain string tables for that locale (from a resource pack), and the schema accessor for the
  active schema config. Every locale function takes it first.
- Anything derived from locale data (number params, context transforms, parsed patterns) is cached
  in a module-level `WeakMap` keyed by the data object, invisible to callers. Caches keyed by
  pattern strings are module-level and bounded.
- The resource pack format, the loader contract and the schema layout are unchanged.

### 4. One swappable input per kind of data

- Locale data: resource packs, through a loader (unchanged contract).
- Time zone data: the `@phensley/timezone` package holds the active tz data. It defaults to the
  bundled `autogen.zonedata.ts` (same file and `RawData` format as 1.x, so the tzdb 2026f update in
  the other clone merges cleanly) and can be replaced with `setTimeZoneData(raw)`.

### 5. Tree-shaking hygiene

- Every package sets `"sideEffects": false`.
- No top-level code with side effects. Top-level calls that build tables are wrapped so bundlers
  can drop them (`/*#__PURE__*/` annotation, or built lazily on first use).
- Nothing is registered by import side effect; if you call a function you imported it, so a
  missing import is a compile error.

### 6. Calendars

- A calendar system (gregorian, iso8601, buddhist, japanese, persian) is a plain record of rules
  (`CalendarSystem`: month/day/year arithmetic, julian-day conversion, era rules). Dates are plain
  data that carry a reference to their calendar record; the shared date functions
  (`dateAdd`, `dateYear`, …) use the record. No class hierarchy.

### 7. Optional convenience layer

- `@phensley/cldr` keeps a "batteries included" object (`framework.get('en').Numbers.formatDecimal`)
  built by binding the functions to a `LocaleData`. It imports everything; the functions underneath
  stay tree-shakable on their own.

### 8. Tests

- The 1.x tests are the specification. They are ported to the function API mechanically with a
  type-aware codemod (`a.add(b)` → `decimalAdd(a, b)`, `new Decimal(x)` → `decimal(x)`,
  `` `${d}` `` → `` `${decimalToString(d)}` ``), so assertions are untouched.
- No assertion is deleted or loosened. Where 1.x behaviour is a bug, the 1.x behaviour is kept and
  the bug is listed below.

## How the port is done

Each value type / package goes through the same steps, keeping the full suite green between
commits:

1. Write the functional implementation (a faithful port of the class, method by method).
2. While the old class still exists, run a type-aware codemod (ts-morph) over the whole repo:
   it finds calls whose receiver/declaration is the old class and rewrites them
   (`n.setScale(2).stripTrailingZeros()` → `decimalStripTrailingZeros(decimalSetScale(n, 2))`),
   handles statics, `new`, `instanceof` and implicit string conversion, and adds imports.
   Ambiguous receivers (e.g. `string | Decimal`) are reported and fixed by hand.
3. Swap in the new implementation, build, run the full suite, lint, commit.

Independent packages were ported in parallel by helper agents in separate worktrees, each with a
differential check against the 1.x code on top of the existing tests; their call-site mappings
were then applied to the rest of the repo in this branch.

## API overview (2.x)

- **Locale data:** `createFramework({ loader, config? })` → `loadLocale(framework, 'en-US')`
  (or `loadLocaleAsync`) returns a `LocaleData`: the plain `Bundle` of the locale plus
  `{ locale, schema, indices, config }`. `@phensley/cldr` exports `createFramework` /
  `cldrFramework` that default to the config its packs were built with.
- **Locale functions** keep the 1.x method names: `formatDecimal(en, n, opts)`,
  `formatCurrency`, `formatQuantity`, `formatDate`, `formatDateInterval`,
  `formatRelativeTime(Field)`, `getLanguageDisplayName`, `formatList`, `messageFormatter`, …
  Ones that never used locale data don't take it (`resolveTimeZoneId`, `timeZoneFromUTC`,
  `timeZoneFromWall`, `timeZoneIds`, `timePeriodToQuantity`, `getCurrencyFractions`,
  `getCurrencyForRegion`, `resolveLocale`, `parseLanguageTag`, `availableLocales`, `cldrVersion`).
- **Value types:** `decimal(x)` + `decimal*`, `rational(...)` + `rational*`, `languageTag(...)` +
  `tag*`, calendar dates: `gregorianDateFromUnixEpoch(...)` (etc. per calendar) + `date*`
  (`dateAdd`, `dateYear`, `dateUntil`, `dateToISOString`, …). Calendar systems are records:
  `gregorianCalendar`, `iso8601Calendar`, `buddhistCalendar`, `japaneseCalendar`, `persianCalendar`.
- **Engines as records:** `getPluralRules` + `pluralCardinal/Ordinal/Range`,
  `createMessageFormatter` + `formatMessage`, `createLocaleMatcher` + `matchLocale`,
  `createUnitConverter` + `convertUnits`, `createRBNF` + `rbnfSetFormat`, `tz*` functions with
  `setTimeZoneData`.
- **Convenience layer:** `cldrFramework(options).get('en')` returns the 1.x-shaped object
  (`.Numbers.formatDecimal(...)`, `.Calendars.formatDate(...)`, `.General`, `.Units`, `.Schema`,
  plus `.data`, the bound `LocaleData`). Built by `bindCLDR` / `bindNumbers` / … from the functions.

## Design decisions made along the way

- **`LocaleData` extends `Bundle`.** Every 1.x internal took `bundle` plus a hidden `this.internals`
  (schema, config). Making the locale data a bundle that also carries its schema/config let every
  internal keep its shape (`renderDecimal(data, …)` where it was `formatDecimal(bundle, …)`) and let
  the codemod rewrite the call sites mechanically. It is one flat plain object.
- **Caches.** Per-locale derived data (number params, context transforms, calendar patterns,
  exemplar cities) lives in module-level `WeakMap`s keyed by the `LocaleData`. Pattern parse caches
  (number, date, wrapper, day-period rules) are module-level bounded LRUs created on first use;
  `patternCacheSize` is accepted but no longer used (results never depended on it).
- **Mutable containers, deliberately.** Caches and accumulators are mutable records owned by the
  functions that use them: `LRU`/`Cache`/`Heap`/`Checksum` (cldr-utils), the pack's region-index
  cache, the tz database's lazily decoded zone records, `NumberContext` (per format call),
  `DateSkeleton`/`DatePatternMatcher` (1.x `split()` mutates its input; kept), and the string/parts
  value builders. Value types (Decimal, Rational, LanguageTag, CalendarDate, Bundle, LocaleData,
  schema arrows) are never mutated after creation.
- **Records of functions** are used where 1.x had small strategy objects: `stringValue()` /
  `partsValue()`, decimal formatters, number renderers, `MessageMatcher`, `MessageArgConverter`.
  They are closures, not classes, and are created per use.
- **No classes kept.** Nothing turned out to be worse without one.
- **Time zone data** is the one swappable input in `@phensley/timezone` (`setTimeZoneData`), decoded
  lazily; locale data comes in only through packs + loader.
- **`@phensley/cldr`** no longer sets a global default config on import (that side effect is exactly
  what prevents tree-shaking and would be dropped under `sideEffects: false`). It exports
  `createFramework` / `cldrFramework` wrappers that default to its config instead.
- **Internals are not exported from package indexes beyond what 1.x exported**; tests of internal
  modules import them by module path.

## Progress

| Package | Status | Tests (files/tests), baseline → now |
|---|---|---|
| decimal | done | 15/119 → 15/119 |
| timezone | done | 5/16 → 6/18 (+2 for `setTimeZoneData`) |
| language-tag | done | 3/13 → 3/13 |
| locale | done | 3/11 → 3/11 |
| locale-matcher | done | 3/183 → 3/183 |
| plurals | done | 6/349 → 6/349 |
| messageformat | done | 6/40 → 6/40 |
| unit-converter | done | 7/27 → 7/28 (+1 immutability) |
| cldr-ext-rbnf | done | 1/2 → 2/5 (+3 with values recorded from 1.x) |
| cldr-utils | done | 5/9 → 5/9 |
| cldr-types | done (types for the plain arrows/bundle) | — |
| cldr-core | done | 106/508 → 106/508 |
| cldr (aggregate + convenience) | done | 3/11 → 3/11 |
| cldr-compiler | adapted to the new core API (still class-based internally) | 7/21 → 7/21 |

## Performance

Measured after a follow-up fix: the calendar internals imported the `date*` accessors through the
`systems/calendars` index barrel, and in the CommonJS build every re-exported name is read through
a getter, so every field read while formatting paid an extra call (1.x called methods on the date
directly). Internal imports now point at the defining modules (`ts-morph` script; 37 imports).

ES-module bundle (esbuild, as an app would ship it), ops/s, two runs each:

| call | 1.x | 2.x |
|---|---|---|
| formatDecimal | 1.77–1.82M | 1.79–1.83M |
| formatCurrency | 1.03–1.06M | 1.06–1.07M |
| formatDate prebuilt date, datetime long | 1.36–1.37M | 1.29–1.32M |
| formatDate prebuilt date, date short | 3.71–3.89M | 3.80–3.87M |
| formatDate `{ date, zoneId }`, datetime long | 0.85M | 0.92–0.96M |

Date creation is ~60% faster than 1.x (no per-instance class setup); plain accessors are equal;
week accessors are ~3× slower (recomputed per call, see open items).

### Benchmarks in the repo (Vitest bench)

`pnpm bench` runs Vitest bench suites in `packages/*/__benchmarks__/*.bench.ts`: decimal
(parse, arithmetic, toString/toParts), plurals (en/fr/ru/ar cardinal, ordinal), messageformat
(parse, evaluate, formatMessage), cldr-core numbers (formatDecimal styles, formatCurrency incl.
compact/accounting/name), units (formatQuantity, sequences), dates (creation, accessors incl.
week fields, dateAdd/dateUntil/dateDifference), date formatting (prebuilt dates and
`{ date, zoneId }`, widths, skeletons, intervals, relative time), plus `packages/cldr`'s
`cjs.bench.ts`, which loads the built CommonJS `lib/` with Node's `require`. Save/compare with
`--outputJson` / `--compare` (README "Benchmarks"). The suites stay out of the test run
(`benchmark.include` in `vitest.shared.ts`) and are linted. The old benchmark.js suites are
`pnpm bench:legacy`.

Under Vitest the sources run through Vite's SSR transform, which turns every export into a getter
and every import into a property read on a module object, and tinybench times each iteration, so
absolute numbers are well below plain Node (formatDecimal ~1.1M ops/s vs ~2.0M in the CJS
suite; a week-field read ~6.5M vs ~28M). Use them for before/after comparisons of the same
suite; use the CJS suite (or the esbuild scripts) for absolute numbers.

## Deviations from 1.x

- Test ports: `decimal/__tests__/parse.test.ts` compared against literals with the private
  1.x field name `_exp`; the plain-data field is the public `exp`, so the expected literals use
  that key. Values asserted are unchanged.
- `@phensley/cldr` re-exports `@phensley/cldr-core` wholesale instead of an explicit name list.
- timezone: the raw tz data is no longer blanked after decoding (1.x mutated its input), so it
  stays in memory next to the decoded records; that is what makes `setTimeZoneData` reversible.
  The zone-type lookup table is replaced by `parseInt(c, 36)` (same result for every character
  the encoder emits).
- language-tag: `tagExtensions`/`tagExtensionSubtags`/`tagExtlangs` return readonly arrays.
  `isLanguageTag` is a shape check, so a plain object shaped like a tag passes where 1.x
  `instanceof` would fail.
- locale-matcher: the matcher record's internal fields are `{ supported, defaultEntry, exactMap }`;
  `LocaleMatcherEntry` is newly exported because the public type refers to it.

- Test ports that read 1.x private fields: `cldr-core/__tests__/cldr.test.ts` checked the path
  `bundle._id` on the 1.x `CLDRImpl` object; it now checks `data.id` (async loader tests) and
  `bundle.id`. Values asserted are unchanged.
- `CLDRFramework` is no longer a class: `cldrFramework(options, defaultConfig?)` returns the
  loader object; `setDefaultConfig`, `CLDRFramework.resolveLocale/parseLanguageTag/
  availableLocales/version` are plain functions. The `CLDR` object has no `Internals`; it has
  `data` (the bound `LocaleData`). Its function groups are non-enumerable getters, so `toEqual`
  between two CLDR objects compares their data (as 1.x, where methods lived on the prototype).
- `General.bundle()` (convenience layer) returns the `LocaleData`, which is a `Bundle`.
- `patternCacheSize` no longer configures anything (shared fixed-size caches).
- `buildOrigin` (1.x `CodeBuilder.origin()`) still sets `config.calendars = ['gregory']` on the
  config object passed in when it is empty — mutation of the caller's config kept from 1.x.
- messageformat: `evaluateMessage` is stateless; 1.x `MessageEngine` kept its output buffer on the
  instance, so calling `evaluate` twice on one engine concatenated results (nothing in the library
  did that).
- unit-converter: `unitConverterAdd` returns a new converter (1.x `add` mutated in place).
- cldr-ext-rbnf: the algorithmic numbering systems no longer append the root rule names into the
  shared rule set's `pubnames` array (1.x mutated it, so building the systems twice duplicated
  names). Only visible through `systems.rbnfset.pubnames`. **See "Unsure" below.**
- calendars: the calendar module's own `ZoneInfo` type is `DateZoneInfo` (it clashed with the
  timezone package's `ZoneInfo` in the flat exports). `CalendarDate`/`GregorianDate`/... are
  types only; use `isCalendarDate`/`isGregorianDate`/... instead of `instanceof`
  (`isGregorianDate` is true for iso8601/buddhist/japanese, as `instanceof GregorianDate` was).
  `currentMetazone()` builds its index on first use (1.x threw if called before anything had
  initialised it).
- plurals: `getPluralRules` returns a plain record; `numberOperands` is a plain record.

## 1.x bugs / oddities found (behaviour preserved unless noted)

- timezone 1.x `TzImpl` constructor mutated the `RawData` passed to it (blanked strings after
  decoding), so a second instance from the same data broke. Fixed as a side effect of making the
  data swappable (no behaviour visible through the public API changes).
- timezone README wall-clock example called `fromUTC` and destructured a pair; should be
  `fromWall`. README fixed.
- language-tag: the extlang pattern `/^[a-z]{3}$/i` also matches 3-letter region codes, so
  `en-AAA` resolves to `aaa-Latn-AA` (asserted by a test; kept).
- language-tag: parsing keeps only the first variant; resolving drops extlangs; `fr-u-ca` gives
  `{u: ['ca']}` (kept).
- language-tag: the constructor keeps the caller's `extensions` object by reference (kept).
- messageformat: the argument regexp `(0[1..9]+|\d+|…)` uses the class `[1..9]` (matches `1`, `.`,
  `9`); `[1-9]` was clearly intended. Kept.
- messageformat/plurals docs: `DefaultMessageArgConverter.asDecimal` says it returns zero but
  returns NaN; `NumberOperands` docs list an `e` operand that isn't implemented; the plurals README
  was titled "@phensley/timezone".
- calendars: Persian `set`/`fromFields` ignore `zoneId` (keep the date's zone; `fromFields` builds
  in UTC), so `add()`'s `set({zoneId:'UTC'})` is a no-op for Persian dates. Kept.
- calendars: `add`/`until` for Persian dates use Gregorian month lengths and 12-month arithmetic.
  Kept.
- calendars: ISO8601 and Japanese `fromFields` apply no defaults, so e.g. `{ year: 2024 }` without a
  month throws "Cannot read properties of undefined". Kept.
- calendars: `millisToTimePeriod` never sets `day`, so the `time.day` added in `add()` is always 0.
  `toLocalISOString` zero-pads possibly negative hour/minute offsets. Kept.
- cldr-ext-rbnf: the id loop in the algorithmic systems never stops at the first match — the last id
  wins, and an undefined last id falls back to root even when an earlier id matched. Kept.
- unit-converter: categories are stored in a plain `{}`, so `unitConverterHas(c, 'constructor')`
  is true and a category named `toString` throws; `convertUnits` rounds the combined factor to the
  MathContext before multiplying (3 ft → 0.9999999 yd at precision 7). Kept.


## Differential check (locale API)

The 1.x reference build and this branch were run side by side (separate node processes, same
seeded inputs, one JSON line per call, diffed line by line): **2,197,323 calls, zero
differences**, both through the 2.x functions directly and through the convenience layer. Errors
(20,704 calls, e.g. currency formatting of NaN) have identical messages on both sides.

- Locales: all 429 available, plus 40 extra ids (unicode extensions `-u-nu-arab`, `-u-ca-japanese`,
  `-u-hc-h23`, …; unknown regions/scripts like `ar-Arab-XX`, `en-Cyrl`; aliases; `und`; private use).
- Numbers: formatDecimal(+ToParts) ~409k, formatCurrency(+ToParts) ~332k (every style, digit
  option, rounding mode, 12 numbering systems, cash, narrow symbols), symbols/names/plurals/adjust.
- Units: formatQuantity(+ToParts, Sequence) ~130k+, display names, availableUnits.
- Calendars: formatDate(+ToParts) ~348k (37 epochs incl. DST edges, era changes, years 1–9999 and
  negative × 28 zones incl. invalid/alias × ~130 skeletons/widths × ca/nu/context/alt);
  intervals ~130k; relative time ~103k; raw/wrapper formats; field names for every calendar
  ~190k; timeZoneInfo, timeData, week data, fieldOfVisualDifference, to*/new*Date in all five
  calendars (compared through 35 date fields).
- General: lists, ~114k display names, measurement system, layout, ~19.5k message formats.
- Locale-independent: tag parsing/resolution, time zone lookups, time periods, currency data.

The only flagged line is the deliberately unknown locale `xx`, which fails to load on both sides
with an error that contains each checkout's own pack path.

Shared oddity seen there (kept from 1.x): `newJapaneseDate` / `newISO8601Date` throw "Cannot read
properties of undefined" for some field sets (no defaults are applied; listed under 1.x bugs).

## What's left / rough edges

- **Versioning and changelog.** Package versions are still 1.16.0 and there is no CHANGELOG
  entry. The pack checksum is derived from `major.minor`, so bumping to 2.0 changes it and the
  packs must be rebuilt at release (the build does that). Left for Stephen to decide.
- **Docs.** The README has a short 2.x usage section and the per-package READMEs touched by the
  ports were updated, but the documentation site / `docs` content still describes the 1.x API.
- **cldr-compiler** (build-time CLI) still contains classes internally; it only had its imports
  adapted. It isn't bundled into apps, so it was out of scope for tree-shaking.
- **Week accessors** (`dateWeekOfYear`, `dateWeekOfMonth`, ...) recompute per call (~3× slower than
  1.x, which memoized them on the mutable date). Only patterns with week fields use them. If it
  matters, compute them once at date creation (creation is already ~60% faster than 1.x).
- **Naming.** The value-type prefix rule produces some long names (`decimalStripTrailingZeros`,
  `dateYearOfWeekOfYearISO`). It keeps the flat export namespace collision-free and makes
  autocomplete work by type; worth a look before the API is frozen.
- **Merging the tzdb 2026f work.** The data file `packages/timezone/src/autogen.zonedata.ts` and its
  format are unchanged here, so a data-only update merges cleanly. If the other clone also edited
  `packages/timezone/src/index.ts`, that will conflict: the runtime code moved to `src/tz.ts` and
  `src/database.ts`.
- **`examples/tree-shaking/measure.mjs`** needs a built 1.x checkout for the 1.x columns
  (`--v1 <path>`); the 2.x numbers don't.

## Unsure / worth a second look

- **cldr-ext-rbnf `pubnames`** (above): the helper that ported it removed a 1.x in-place mutation of
  shared rule-set data instead of reproducing it. Reproducing it would mean mutating shared data;
  the extension isn't used by cldr-core. I left the fix in and flagged it, since the brief says to
  keep 1.x behaviour.
- **`patternCacheSize`** is now a no-op. If anyone tuned it for memory, they'd want a way to size
  the shared caches; easy to add back as a function if needed.
- **Convenience object shape:** I dropped `Internals` (undocumented, `@internal`) and added `data`.
- **`isLanguageTag` / `isCalendarDate` / `isDecimal`** are shape checks, so a hand-made object of the
  right shape passes where 1.x `instanceof` failed.
