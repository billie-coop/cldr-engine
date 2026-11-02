# website

Live examples of the library: numbers, currency, decimal math, days / times / zones, units,
lists and messages, and locale matching. Every example shows the call next to its result, for
any of the 429 locales and any time zone. Vite + React + Tailwind.

```sh
yarn build      # from the repo root: builds the packages and the locale packs
yarn website    # dev server
yarn website:build   # static site in apps/website/dist (relative paths, works under any base URL)
```

Locale packs are loaded on demand, one chunk per language, straight from
`packages/cldr/packs`. The app imports the built packages (`lib-es`), so rebuild a package
after changing it.

It replaces the old `cldr-engine-react-demo` (Create React App + Redux) with the 2.x function
API and adds the `@phensley/datetime` examples.
