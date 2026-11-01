# Functional rewrite (2.x) — working log

Branch: `functional-rewrite`. Started 2026-11-01 from `main` @ `3f51c5a4` (v1.16.0).

_(Final summary goes here when the port is complete.)_

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

## Progress

| Package | Status | Tests (files/tests) |
|---|---|---|
| decimal | done — `Decimal`, `Rational` plain data; `decimal*`, `rational*` functions | 15/119 |
| timezone | done — `tz*` functions over swappable tz data (`setTimeZoneData`) | 6/18 (+2 new) |
| language-tag | done — `LanguageTag` plain record, `tag*` accessors | 3/13 |
| locale | done — `resolveLanguageTag`, `resolveLocaleId`, … | 3/11 |
| locale-matcher | done — `createLocaleMatcher` + `matchLocale` | 3/183 |
| plurals, messageformat | in progress (helper) | |
| unit-converter, cldr-ext-rbnf | in progress (helper) | |
| cldr-utils | todo | |
| cldr-core | todo | |
| cldr (aggregate + convenience layer) | todo | |

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
