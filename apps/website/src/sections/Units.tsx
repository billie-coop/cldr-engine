import {
  decimal,
  decimalToString,
  formatQuantity,
  type LocaleData,
  measurementSystem,
  type UnitType,
} from '@phensley/cldr';
import {
  convertUnits,
  createUnitConverter,
  LENGTH,
  MASS,
  unitFactors,
} from '@phensley/unit-converter';
import { useState } from 'react';
import { attempt, Example, Field, q, Section, Select } from '../ui';

const converter = createUnitConverter({ length: unitFactors(LENGTH), mass: unitFactors(MASS) });

// Unit, its category, and what to show it as in the other measurement system.
const UNITS: [UnitType, string, UnitType][] = [
  ['kilometer', 'length', 'mile'],
  ['mile', 'length', 'kilometer'],
  ['meter', 'length', 'foot'],
  ['kilogram', 'mass', 'pound'],
  ['pound', 'mass', 'kilogram'],
];

export const Units = ({ cldr }: { cldr: LocaleData }) => {
  const [value, setValue] = useState('42.195');
  const [unit, setUnit] = useState<string>('kilometer');
  const [u, category, other] = UNITS.find((x) => x[0] === unit) ?? (UNITS[0] as (typeof UNITS)[0]);
  const converted = () =>
    convertUnits(converter, category, decimal(value), u, other, { precision: 6 });
  const rows: [string, () => string][] = [
    [
      `formatQuantity(locale, { value: ${q(value)}, unit: ${q(u)} })`,
      () => formatQuantity(cldr, { value, unit: u }),
    ],
    [
      `formatQuantity(locale, { value: ${q(value)}, unit: ${q(u)} }, { length: 'short' })`,
      () => formatQuantity(cldr, { value, unit: u }, { length: 'short' }),
    ],
    [
      `formatQuantity(locale, { value: ${q(value)}, unit: ${q(u)} }, { length: 'narrow' })`,
      () => formatQuantity(cldr, { value, unit: u }, { length: 'narrow' }),
    ],
    [
      `convertUnits(converter, ${q(category)}, decimal(${q(value)}), ${q(u)}, ${q(other)}, { precision: 6 })`,
      () => {
        const r = converted();
        return r ? decimalToString(r) : 'no conversion';
      },
    ],
    [
      `formatQuantity(locale, { value: converted, unit: ${q(other)} }, { maximumFractionDigits: 2 })`,
      () => {
        const r = converted();
        return r
          ? formatQuantity(cldr, { value: r, unit: other }, { maximumFractionDigits: 2 })
          : '';
      },
    ],
    [
      `formatQuantity(locale, { value: '30', unit: 'kilometer', per: 'hour' })`,
      () => formatQuantity(cldr, { value: '30', unit: 'kilometer', per: 'hour' }),
    ],
  ];
  return (
    <Section
      id="units"
      title="Units"
      intro={
        <>
          Quantities in three lengths, and exact conversion with{' '}
          <code>@phensley/unit-converter</code>. This locale measures in the{' '}
          <b>{measurementSystem(cldr)}</b> system (<code>measurementSystem(locale)</code>).
        </>
      }
      controls={
        <>
          <Field label="Value" value={value} onChange={setValue} className="w-28" />
          <Select
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={UNITS.map(([v]) => ({ value: v, label: v }))}
          />
        </>
      }
    >
      {rows.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
    </Section>
  );
};
