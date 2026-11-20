// Recurring Polish public holidays, including the Christmas Eve change from 2025.
const fixedPolishHolidays = {
  '01-01':'Nowy Rok',
  '01-06':'Święto Trzech Króli',
  '05-01':'Święto Państwowe',
  '05-03':'Święto Narodowe Trzeciego Maja',
  '08-15':'Wniebowzięcie NMP',
  '11-01':'Wszystkich Świętych',
  '11-11':'Narodowe Święto Niepodległości',
  '12-24':'Wigilia Bożego Narodzenia',
  '12-25':'Boże Narodzenie',
  '12-26':'Drugi dzień Bożego Narodzenia'
};
const movablePolishHolidays = new Map();

function polishHoliday(day) {
  const year=Number(day.slice(0,4));
  const monthDay=day.slice(5);
  if ((monthDay==='12-24'&&year<2025)||(monthDay==='01-06'&&year<2011)) return null;
  if (Object.hasOwn(fixedPolishHolidays,monthDay)) return fixedPolishHolidays[monthDay];
  if (!movablePolishHolidays.has(year)) {
    // Gregorian Meeus–Jones–Butcher computus.
    const cycle=year%19;
    const century=Math.floor(year/100);
    const centuryYear=year%100;
    const leapCenturies=Math.floor(century/4);
    const moonCorrection=Math.floor((century-Math.floor((century+8)/25)+1)/3);
    const moon=(19*cycle+century-leapCenturies-moonCorrection+15)%30;
    const weekdayCorrection=(32+2*(century%4)+2*Math.floor(centuryYear/4)-moon-centuryYear%4)%7;
    const correction=Math.floor((cycle+11*moon+22*weekdayCorrection)/451);
    const easter=moon+weekdayCorrection-7*correction+114;
    const month=Math.floor(easter/31)-1;
    const date=easter%31+1;
    const holidays=[[0,'Wielkanoc'],[1,'Poniedziałek Wielkanocny'],[49,'Zielone Świątki'],[60,'Boże Ciało']];
    movablePolishHolidays.set(year,new Map(holidays.map(([offset,name])=>{
      const holiday=new Date(0);
      holiday.setUTCFullYear(year,month,date+offset);
      return [holiday.toISOString().slice(0,10),name];
    })));
  }
  return movablePolishHolidays.get(year).get(day)??null;
}

function isSalonWorkday(day) {
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  return weekday!==0&&(weekday!==6||day>='2026-11-19')&&!polishHoliday(day);
}
