import { DateTimeNode } from '../../parsing/date';
import { NumberParams } from '../../common/private';

export interface DateFormatRequest {
  wrapper?: string;
  date?: readonly DateTimeNode[];
  time?: readonly DateTimeNode[];
  params: NumberParams;
}

export interface DateIntervalFormatRequest {
  date?: readonly DateTimeNode[];
  time?: readonly DateTimeNode[];
  range?: readonly DateTimeNode[];
  skeleton?: string;
  params: NumberParams;
  wrapper: string;
}
