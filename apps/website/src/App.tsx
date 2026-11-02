import {
  cldrVersion,
  getLanguageDisplayName,
  type LocaleData,
  systemTimeZone,
  timeZoneIds,
} from '@phensley/cldr';
import { useEffect, useMemo, useState } from 'react';
import { cldrDataVersion, initialLocale, LOCALES, loadLocale } from './locale';
import { Dates } from './sections/Dates';
import { DecimalMath } from './sections/DecimalMath';
import { Matching } from './sections/Matching';
import { Messages } from './sections/Messages';
import { Currency, Numbers } from './sections/Numbers';
import { Units } from './sections/Units';
import { Select } from './ui';

const QUICK = [
  'en-US',
  'en-GB',
  'de-DE',
  'fr-FR',
  'es-MX',
  'pt-BR',
  'ja-JP',
  'zh-Hant-TW',
  'ar-EG',
  'hi-IN',
];
const ZONES = [...timeZoneIds()].sort();

const NAV = [
  ['numbers', 'Numbers'],
  ['currency', 'Currency'],
  ['math', 'Decimal math'],
  ['dates', 'Dates'],
  ['units', 'Units'],
  ['messages', 'Messages'],
  ['matching', 'Matching'],
];

export const App = () => {
  const [localeId, setLocaleId] = useState(initialLocale);
  const [zone, setZone] = useState(() => systemTimeZone() ?? 'Etc/UTC');
  const [cldr, setCldr] = useState<LocaleData>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    loadLocale(localeId)
      .then((data) => live && (setCldr(data), setError(undefined)))
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [localeId]);

  // availableLocales() lists 'en', not 'en-US'; keep the chosen id in the list either way.
  const localeOptions = useMemo(() => {
    const ids = LOCALES.includes(localeId) ? LOCALES : [localeId, ...LOCALES];
    return cldr
      ? ids
          .map((id) => ({ value: id, label: `${getLanguageDisplayName(cldr, id)} · ${id}` }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : ids.map((id) => ({ value: id, label: id }));
  }, [cldr, localeId]);

  if (error) {
    return <p className="p-8 text-red-600">Couldn't load locale data: {error}</p>;
  }
  if (!cldr) {
    return <p className="p-8 text-zinc-500">Loading locale data…</p>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="top-0 z-10 sm:sticky border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3">
          <div className="mr-auto">
            <h1 className="text-xl font-semibold tracking-tight">cldr-engine 2</h1>
            <p className="text-xs text-zinc-500">
              v{cldrVersion()} · CLDR {cldrDataVersion} · plain functions over plain data · every
              example runs live
            </p>
          </div>
          <Select
            label="Locale"
            value={localeId}
            onChange={setLocaleId}
            options={localeOptions}
            className="w-64"
          />
          <Select
            label="Time zone"
            value={zone}
            onChange={setZone}
            options={ZONES.map((z) => ({ value: z, label: z }))}
            className="w-56"
          />
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-sm">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {label}
            </a>
          ))}
          <span className="ml-auto flex flex-wrap gap-1.5">
            {QUICK.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setLocaleId(id)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  id === localeId
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {id}
              </button>
            ))}
          </span>
        </nav>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Locale data is a plain object (
          <code>const locale = await loadLocaleAsync(framework, '{localeId}')</code>) passed to
          plain functions. Bundlers keep only the functions you import: number formatting alone is
          about 42 KB gzipped, day math alone about 1.3 KB.
        </p>
        <Numbers cldr={cldr} />
        <Currency cldr={cldr} />
        <DecimalMath cldr={cldr} />
        <Dates cldr={cldr} zone={zone} />
        <Units cldr={cldr} />
        <Messages cldr={cldr} />
        <Matching cldr={cldr} />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-zinc-500">
        Built on{' '}
        <a className="underline" href="https://github.com/phensley/cldr-engine">
          cldr-engine
        </a>{' '}
        by Patrick Hensley, with CLDR data from the Unicode Consortium and time zones from the IANA
        tz database.
      </footer>
    </div>
  );
};
