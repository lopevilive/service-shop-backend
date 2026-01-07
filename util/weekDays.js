const getBeijingDateInfo = (date) => {
  const utcTime = date.getTime(); // 获取时间戳（毫秒）
  const beijingOffset = 8 * 3600 * 1000; // 北京时间UTC+8偏移（毫秒）
  const beijingTime = new Date(utcTime + beijingOffset); // 转为北京时间的Date（基于UTC）
  
  return {
    year: beijingTime.getUTCFullYear(), // 北京时间的年
    month: beijingTime.getUTCMonth() + 1, // 北京时间的月（UTC月从0开始）
    day: beijingTime.getUTCDate(), // 北京时间的日
    dayOfWeek: beijingTime.getUTCDay() // 北京时间的星期（0=周日，1=周一...6=周六）
  };
};

// 获取当前北京时间的年份（修复this指向问题）
module.exports.getBeijingYear = () => {
  return getBeijingDateInfo(new Date()).year;
};


/**
 * 获取指定年份的所有工作日（格式：YYYY-MM-DD）
 * @param {number} [year=当前年份] - 目标年份，如 2025、2026
 * @returns {string[]} 当年所有工作日的日期数组
 */
module.exports.getYearWorkdays = (year = this.getBeijingYear()) => {
    // 1. 定义各年份的节假日和调休规则（可扩展更多年份）
    const holidayConfig = {
        2024: {holidays: [], makeUpDays: []},
        2025: {
          holidays: [
            '2025-01-01', // 元旦
            '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', // 春节
            '2025-04-04', '2025-04-05', '2025-04-06', // 清明节
            '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05', // 劳动节
            '2025-06-02',  // 端午节
            // 中秋节
            '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07',  '2025-10-08'// 国庆节
          ],
          makeUpDays: ['2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28' ,'2025-10-11']
        },
        2026: {
          holidays: [
            '2026-01-01', '2026-01-02', '2026-01-03',  // 元旦
            '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
            '2026-04-04', '2026-04-05', '2026-04-06',
            '2026-05-01','2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
            '2026-06-19', '2026-06-20', '2026-06-21',
            '2026-09-25', '2026-09-26', '2026-09-27',
            '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'
          ],
          makeUpDays: ['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10']
        },
        2027: {
          holidays: [],
          makeUpDays: []
        },
    };

    // 校验年份配置
  if (!holidayConfig[year]) {
    console.warn(`暂未配置${year}年的节假日规则，仅排除周末作为工作日`);
  }

  const { holidays = [], makeUpDays = [] } = holidayConfig[year] || {};
  const workDays = [];

  // 初始化：基于UTC时间创建「北京时间的该年1月1日 00:00」
  const startUtc = new Date(Date.UTC(year, 0, 1) - 8 * 3600 * 1000); 
  let currentDate = new Date(startUtc);

  // 遍历该年的每一天（基于北京时间判断年份）
  while (true) {
    const beijingInfo = getBeijingDateInfo(currentDate);
    // 超出目标年份则终止循环
    if (beijingInfo.year !== year) break;

    // 拼接北京时间的YYYY-MM-DD
    const y = beijingInfo.year;
    const m = String(beijingInfo.month).padStart(2, '0');
    const d = String(beijingInfo.day).padStart(2, '0');
    const currentDateStr = `${y}-${m}-${d}`;

    // 判断是否为工作日（基于北京时间的星期）
    const isMakeUpDay = makeUpDays.includes(currentDateStr);
    const isHoliday = holidays.includes(currentDateStr);
    const isWeekend = beijingInfo.dayOfWeek === 0 || beijingInfo.dayOfWeek === 6;

    if (isMakeUpDay || (!isWeekend && !isHoliday)) {
      workDays.push(currentDateStr);
    }

    // 日期加1天（基于UTC，避免时区偏移导致的跨天错误）
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return workDays;
}

