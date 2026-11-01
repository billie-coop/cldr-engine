import { createFramework, CalendarType, SchemaConfig, getCalendarFormatter, selectCalendar } from '../../src';
import { languageBundle } from '../_helpers';

test('skip checksum', () => {
  const framework = createFramework({ config: {} as SchemaConfig, skipChecksum: true });
  expect(framework.checksum).toEqual('');
});

test('calendar lookup', () => {
  const formatter = getCalendarFormatter(languageBundle('en'), 'x' as CalendarType);
  console.log(formatter);
});

test('select calendar', () => {
  const bundle = languageBundle('und-TH');
  console.log(bundle.languageRegion);
  const cal = selectCalendar(bundle);
  expect(cal).toEqual('buddhist');
});
