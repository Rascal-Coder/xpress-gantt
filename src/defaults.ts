import date_utils from './date-utils';

/**
 * 获取日期所在的十年开始年份
 * @param d 输入日期
 * @returns 十年的开始年份，如2020年代返回"2020"
 * @example
 * getDecade(new Date(2023, 5, 15)) // 返回 "2020"
 * getDecade(new Date(2019, 1, 1)) // 返回 "2010"
 */
function getDecade(d: Date) {
  const year = d.getFullYear();
  return `${year - (year % 10)}`;
}

/**
 * 格式化显示一周的时间范围
 * @param d 当前周的开始日期
 * @param ld 上一个日期（用于判断月份是否变化）
 * @param lang 语言代码
 * @returns 格式化的周范围字符串，如"15 Jan - 21 Jan"或"15 - 21 Jan"
 * @example
 * // 当周开始和结束在同一月份
 * formatWeek(new Date(2023, 0, 15), null, 'zh') // 返回 "15 Jan - 21 Jan"
 * // 当上一个日期与当前日期在同一月份时，开始日期会省略月份
 * formatWeek(new Date(2023, 0, 15), new Date(2023, 0, 8), 'zh') // 返回 "15 - 21 Jan"
 * // 当周跨越两个月份时
 * formatWeek(new Date(2023, 0, 29), new Date(2023, 0, 22), 'zh') // 返回 "29 Jan - 4 Feb"
 */
function formatWeek(d: Date, ld: Date | null, lang: string) {
  const endOfWeek = date_utils.add(d, 6, 'day');
  const endFormat = endOfWeek.getMonth() !== d.getMonth() ? 'D MMM' : 'D';
  const beginFormat = !ld || d.getMonth() !== ld.getMonth() ? 'D MMM' : 'D';
  return `${date_utils.format(d, beginFormat, lang)} - ${date_utils.format(endOfWeek, endFormat, lang)}`;
}

const DEFAULT_VIEW_MODES = [
  {
    name: 'Hour',
    padding: '7d',
    step: '1h',
    date_format: 'YYYY-MM-DD HH:',
    lower_text: 'HH',
    upper_text: (d: Date, ld: Date | null, lang: string) =>
      !ld || d.getDate() !== ld.getDate()
        ? date_utils.format(d, 'D MMMM', lang)
        : '',
    upper_text_frequency: 24,
  },
  {
    name: 'Quarter Day',
    padding: '7d',
    step: '6h',
    date_format: 'YYYY-MM-DD HH:',
    lower_text: 'HH',
    upper_text: (d: Date, ld: Date | null, lang: string) =>
      !ld || d.getDate() !== ld.getDate()
        ? date_utils.format(d, 'D MMM', lang)
        : '',
    upper_text_frequency: 4,
  },
  {
    name: 'Half Day',
    padding: '14d',
    step: '12h',
    date_format: 'YYYY-MM-DD HH:',
    lower_text: 'HH',
    upper_text: (d: Date, ld: Date | null, lang: string) => {
      if (!ld || d.getDate() !== ld.getDate()) {
        const format = d.getMonth() !== ld?.getMonth() ? 'D MMM' : 'D';
        return date_utils.format(d, format, lang);
      }
      return '';
    },
    upper_text_frequency: 2,
  },
  {
    name: 'Day',
    padding: '7d',
    date_format: 'YYYY-MM-DD',
    step: '1d',
    lower_text: (d: Date, ld: Date | null, lang: string) =>
      !ld || d.getDate() !== ld.getDate()
        ? date_utils.format(d, 'D', lang)
        : '',
    upper_text: (d: Date, ld: Date | null, lang: string) =>
      !ld || d.getMonth() !== ld.getMonth()
        ? date_utils.format(d, 'MMMM', lang)
        : '',
    thick_line: (d: Date) => d.getDay() === 1,
  },
  {
    name: 'Week',
    padding: '1m',
    step: '7d',
    date_format: 'YYYY-MM-DD',
    column_width: 140,
    lower_text: formatWeek,
    upper_text: (d: Date, ld: Date | null, lang: string) =>
      !ld || d.getMonth() !== ld.getMonth()
        ? date_utils.format(d, 'MMMM', lang)
        : '',
    thick_line: (d: Date) => d.getDate() >= 1 && d.getDate() <= 7,
    upper_text_frequency: 4,
  },
  {
    name: 'Month',
    padding: '2m',
    step: '1m',
    column_width: 120,
    date_format: 'YYYY-MM',
    lower_text: 'MMMM',
    upper_text: (d: Date, ld: Date | null, lang: string) =>
      !ld || d.getFullYear() !== ld.getFullYear()
        ? date_utils.format(d, 'YYYY', lang)
        : '',
    thick_line: (d: Date) => d.getMonth() % 3 === 0,
    snap_at: '7d',
  },
  {
    name: 'Year',
    padding: '2y',
    step: '1y',
    column_width: 120,
    date_format: 'YYYY',
    upper_text: (d: Date, ld: Date | null, lang: string) =>
      !ld || getDecade(d) !== getDecade(ld) ? getDecade(d) : '',
    lower_text: 'YYYY',
    snap_at: '30d',
  },
];

const DEFAULT_OPTIONS = {
  arrow_curve: 5,
  auto_move_label: false,
  bar_corner_radius: 3,
  bar_height: 30,
  container_height: 'auto',
  column_width: null,
  date_format: 'YYYY-MM-DD HH:mm',
  upper_header_height: 45,
  lower_header_height: 30,
  snap_at: null,
  infinite_padding: true,
  holidays: { 'var(--g-weekend-highlight-color)': 'weekend' },
  ignore: [],
  language: 'en',
  lines: 'both',
  move_dependencies: true,
  padding: 18,
  popup: (ctx: {
    set_title: (title: string) => void;
    set_subtitle: (subtitle: string) => void;
    set_details: (details: string) => void;
    task: {
      name: string;
      description: string;
      _start: Date;
      _end: Date;
      actual_duration: number;
      ignored_duration?: number;
      progress: number;
    };
    chart: {
      options: {
        language: string;
      };
    };
  }) => {
    const start_date = date_utils.format(
      ctx.task._start,
      'MMM D',
      ctx.chart.options.language
    );
    const end_date = date_utils.format(
      date_utils.add(ctx.task._end, -1, 'second'),
      'MMM D',
      ctx.chart.options.language
    );

    ctx.set_details(`
      ${start_date} - ${end_date} (${ctx.task.actual_duration} days${
        ctx.task.ignored_duration
          ? ` + ${ctx.task.ignored_duration} excluded`
          : ''
      })<br/>Progress: ${Math.floor(ctx.task.progress * 100) / 100}%`);
  },
  popup_on: 'click',
  readonly_progress: false,
  readonly_dates: false,
  readonly: false,
  scroll_to: 'today',
  show_expected_progress: false,
  today_button: true,
  view_mode: 'Day',
  view_mode_select: false,
  view_modes: DEFAULT_VIEW_MODES,
};
export { DEFAULT_OPTIONS, DEFAULT_VIEW_MODES };
