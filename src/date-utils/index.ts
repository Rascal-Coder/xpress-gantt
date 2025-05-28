const YEAR = 'year';
const MONTH = 'month';
const DAY = 'day';
const HOUR = 'hour';
const MINUTE = 'minute';
const SECOND = 'second';
const MILLISECOND = 'millisecond';

// const SPACE_REGEX = /\s+/;
const TIME_SEPARATOR_REGEX = /[.:]/;

type DateValues = [number, number, number, number, number, number, number];
export type DateScale =
  | typeof YEAR
  | typeof MONTH
  | typeof DAY
  | typeof HOUR
  | typeof MINUTE
  | typeof SECOND
  | typeof MILLISECOND;
type DurationResult = { duration: number; scale: string } | undefined;

export default {
  parse_duration(duration: string): DurationResult {
    const regex = /([0-9]+)(y|m|d|h|min|s|ms)/gm;
    const matches = regex.exec(duration);
    if (matches !== null) {
      const value = Number.parseInt(matches[1]);
      const unit = matches[2];

      const scaleMap: Record<string, string> = {
        y: YEAR,
        m: MONTH,
        d: DAY,
        h: HOUR,
        min: MINUTE,
        s: SECOND,
        ms: MILLISECOND,
      };

      return scaleMap[unit]
        ? { duration: value, scale: scaleMap[unit] }
        : undefined;
    }
    return undefined;
  },

  parse(
    date: Date | string,
    date_separator = '-',
    time_separator = TIME_SEPARATOR_REGEX
  ): Date | undefined {
    if (date instanceof Date) {
      return date;
    }
    if (typeof date === 'string') {
      const parts = date.split(' ');
      const date_parts: number[] = parts[0]
        .split(date_separator)
        .map((val) => Number.parseInt(val, 10));
      const time_parts: string[] | undefined = parts[1]?.split(time_separator);

      // month is 0 indexed
      date_parts[1] = date_parts[1] ? date_parts[1] - 1 : 0;

      let vals: number[] = date_parts;

      if (time_parts?.length) {
        // 处理时间部分，将字符串转换为数字
        const numericTimeParts: number[] = time_parts.map((part, i) => {
          if (i === 3 && time_parts.length === 4) {
            // 处理毫秒
            return Number.parseFloat(`0.${part}`) * 1000;
          }
          return Number.parseInt(part, 10);
        });

        vals = vals.concat(numericTimeParts);
      }

      return new Date(...(vals as [number, number, number, ...number[]]));
    }
    return undefined;
  },

  to_string(date: Date, with_time = false): string {
    if (!(date instanceof Date)) {
      throw new TypeError('Invalid argument type');
    }
    const vals = this.get_date_values(date).map((val, i) => {
      let result = val;
      if (i === 1) {
        // add 1 for month
        result = val + 1;
      }

      if (i === 6) {
        return padStart(`${result}`, 3, '0');
      }

      return padStart(`${result}`, 2, '0');
    });
    const date_string = `${vals[0]}-${vals[1]}-${vals[2]}`;
    const time_string = `${vals[3]}:${vals[4]}:${vals[5]}.${vals[6]}`;

    return with_time ? `${date_string} ${time_string}` : date_string;
  },

  format(
    date: Date,
    date_format = 'YYYY-MM-DD HH:mm:ss.SSS',
    lang = 'en'
  ): string {
    const dateTimeFormat = new Intl.DateTimeFormat(lang, {
      month: 'long',
    });
    const dateTimeFormatShort = new Intl.DateTimeFormat(lang, {
      month: 'short',
    });
    const month_name = dateTimeFormat.format(date);
    const month_name_capitalized =
      month_name.charAt(0).toUpperCase() + month_name.slice(1);

    const values = this.get_date_values(date).map((d) =>
      padStart(`${d}`, 2, 0)
    );
    const format_map: Record<string, string> = {
      YYYY: values[0],
      MM: padStart(`${+values[1] + 1}`, 2, 0),
      DD: values[2],
      HH: values[3],
      mm: values[4],
      ss: values[5],
      SSS: values[6],
      D: values[2],
      MMMM: month_name_capitalized,
      MMM: dateTimeFormatShort.format(date),
    };

    let str = date_format;
    const formatted_values: string[] = [];

    for (const key of Object.keys(format_map).sort(
      (a, b) => b.length - a.length
    )) {
      if (str.includes(key)) {
        str = str.split(key).join(`$${formatted_values.length}`);
        formatted_values.push(format_map[key]);
      }
    }

    for (let i = 0; i < formatted_values.length; i++) {
      str = str.split(`$${i}`).join(formatted_values[i]);
    }

    return str;
  },

  diff(date_a: Date, date_b: Date, scale = 'day'): number {
    let milliseconds: number,
      seconds: number,
      hours: number,
      minutes: number,
      days: number,
      months: number,
      years: number;

    milliseconds =
      date_a.getTime() -
      date_b.getTime() +
      (date_b.getTimezoneOffset() - date_a.getTimezoneOffset()) * 60000;
    seconds = milliseconds / 1000;
    minutes = seconds / 60;
    hours = minutes / 60;
    days = hours / 24;
    // Calculate months across years
    const yearDiff = date_a.getFullYear() - date_b.getFullYear();
    let monthDiff = date_a.getMonth() - date_b.getMonth();
    // calculate extra
    monthDiff += (days % 30) / 30;

    /* If monthDiff is negative, date_b is in an earlier month than
        date_a and thus subtracted from the year difference in months */
    months = yearDiff * 12 + monthDiff;
    /* If date_a's (e.g. march 1st) day of the month is smaller than date_b (e.g. february 28th),
        adjust the month difference */
    if (date_a.getDate() < date_b.getDate()) {
      months--;
    }

    // Calculate years based on actual months
    years = months / 12;

    let finalScale = scale;
    if (!finalScale.endsWith('s')) {
      finalScale = `${finalScale}s`;
    }

    const scaleValues = {
      milliseconds,
      seconds,
      minutes,
      hours,
      days,
      months,
      years,
    };

    return (
      Math.round(scaleValues[finalScale as keyof typeof scaleValues] * 100) /
      100
    );
  },

  today(): Date {
    const vals = this.get_date_values(new Date()).slice(0, 3) as [
      number,
      number,
      number,
    ];
    return new Date(...vals);
  },

  now(): Date {
    return new Date();
  },

  add(date: Date, qty: string | number, scale: DateScale): Date {
    const quantity = Number.parseInt(`${qty}`, 10);
    const vals: [number, number, number, number, number, number, number] = [
      date.getFullYear() + (scale === YEAR ? quantity : 0),
      date.getMonth() + (scale === MONTH ? quantity : 0),
      date.getDate() + (scale === DAY ? quantity : 0),
      date.getHours() + (scale === HOUR ? quantity : 0),
      date.getMinutes() + (scale === MINUTE ? quantity : 0),
      date.getSeconds() + (scale === SECOND ? quantity : 0),
      date.getMilliseconds() + (scale === MILLISECOND ? quantity : 0),
    ];
    return new Date(...vals);
  },

  start_of(date: Date, scale: DateScale): Date {
    const scores: Record<DateScale, number> = {
      [YEAR]: 6,
      [MONTH]: 5,
      [DAY]: 4,
      [HOUR]: 3,
      [MINUTE]: 2,
      [SECOND]: 1,
      [MILLISECOND]: 0,
    };

    function should_reset(_scale: DateScale): boolean {
      const max_score = scores[scale];
      return scores[_scale] <= max_score;
    }

    const vals: [number, number, number, number, number, number, number] = [
      date.getFullYear(),
      should_reset(YEAR) ? 0 : date.getMonth(),
      should_reset(MONTH) ? 1 : date.getDate(),
      should_reset(DAY) ? 0 : date.getHours(),
      should_reset(HOUR) ? 0 : date.getMinutes(),
      should_reset(MINUTE) ? 0 : date.getSeconds(),
      should_reset(SECOND) ? 0 : date.getMilliseconds(),
    ];

    return new Date(...vals);
  },

  clone(date: Date): Date {
    return new Date(...(this.get_date_values(date) as DateValues));
  },

  get_date_values(date: Date): DateValues {
    return [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ];
  },

  convert_scales(period: string, to_scale: string): number {
    const TO_DAYS: Record<string, number> = {
      millisecond: 1 / 60 / 60 / 24 / 1000,
      second: 1 / 60 / 60 / 24,
      minute: 1 / 60 / 24,
      hour: 1 / 24,
      day: 1,
      month: 30,
      year: 365,
    };
    const result = this.parse_duration(period);
    if (!result) {
      return 0;
    }

    const { duration, scale } = result;
    const in_days = duration * TO_DAYS[scale];
    return in_days / TO_DAYS[to_scale];
  },

  get_days_in_month(date: Date): number {
    const no_of_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const month = date.getMonth();

    if (month !== 1) {
      return no_of_days[month];
    }

    // Feb
    const year = date.getFullYear();
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
      return 29;
    }
    return 28;
  },

  get_days_in_year(date: Date): number {
    return date.getFullYear() % 4 ? 365 : 366;
  },
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
function padStart(
  str: string,
  targetLength: number,
  padString: string | number
): string {
  const strValue = `${str}`;
  const targetLen = targetLength >> 0;
  const padStr = String(typeof padString !== 'undefined' ? padString : ' ');

  if (strValue.length > targetLen) {
    return String(strValue);
  }

  const padLen = targetLen - strValue.length;
  let padding = padStr;

  if (padLen > padStr.length) {
    padding += padStr.repeat(padLen / padStr.length);
  }

  return padding.slice(0, padLen) + strValue;
}
