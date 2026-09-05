import { log } from "node:console";

export const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_START = 420; // 07:00 AM
export const DAY_END = 1200;  // 20:00 (08:00 PM)
export const INTERVAL = 30;   // 30-minute intervals

export const generateValidStartTimes = () => {
  let times = [];
  for (let time = DAY_START; time < DAY_END; time += INTERVAL) {
    times.push(time);
  }
  return times;
};


/*
Strategy: "Minutes from Midnight"
If we convert every time to "Minutes since 12:00 AM":
07:00 AM = (7 * 60) + 0 = 420
09:00 AM = (9 * 60) + 0 = 540
08:00 PM (20:00) = (20 * 60) + 0 = 1200
a 3-hour lab (180 minutes) starting at 7:00 AM simply spans from 420 to 600.
*/


// Converts "07:30" to 450
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + minutes;
}

// Converts 450 back to "07:30" (for the UI)
export function minutesToTime(minutes) {
  const hr = Math.floor(minutes / 60).toString().padStart(2, '0');
  const min = (minutes % 60).toString().padStart(2, '0');
  return `${hr}:${min}`;
}


// The Overlap Formula
// Two intervals overlap if the START of one is before the END of the other, AND vice versa.
export function isTimeOverlap(startA, endA, startB, endB) {
  return (startA < endB) && (startB < endA);
}


export const VALID_START_TIMES = generateValidStartTimes();


// test
// console.log('valid start times (in minutes):', VALID_START_TIMES);