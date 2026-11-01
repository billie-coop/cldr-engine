import { loadPack } from '../_helpers';
import { Pack } from '../../src/resource/pack';
import { languageTag } from '@phensley/language-tag';

test('error bad format', () => {
  expect(() => new Pack({})).toThrowError('Severe error');
  expect(() => new Pack('')).toThrowError('JSON input');
  expect(() => new Pack('{}')).toThrowError('Severe error');
});

test('resolve tag', () => {
  const pack = loadPack('en');
  const b = pack.get(languageTag(undefined));
  expect(b.id()).toEqual('en-Latn-US');
});
