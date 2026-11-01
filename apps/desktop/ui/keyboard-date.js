// Shared calendar rules for the review and the local app. Store dates in local time.
window.calmReference =
  new URLSearchParams(location.search).get("reference") === "1";
const calmDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const calmToday = () =>
  window.calmReference ? "2026-10-14" : calmDateString(new Date());
const calmDateAfter = (days) => {
  const date = new Date(calmToday() + "T12:00:00");
  date.setDate(date.getDate() + days);
  return calmDateString(date);
};
const calmTomorrow = () => calmDateAfter(1);
const calmMonday = () => {
  const date = new Date(calmToday() + "T12:00:00");
  return calmDateAfter(7 - ((date.getDay() + 6) % 7));
};
const calmTodayIndex = () =>
  (new Date(calmToday() + "T12:00:00").getDay() + 6) % 7;
window.calmWeekOffset = 0;
const calmWeekDate = (day) =>
  calmDateAfter(day - calmTodayIndex() + window.calmWeekOffset * 7);
const calmDayLabel = (day, short = false) =>
  new Date(calmWeekDate(day) + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: short ? "short" : "long",
  });
const calmSelectedProject = () => state.projectName || projects[0] || "";

const calmValidDate = (date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  calmDateString(new Date(date + "T12:00:00")) === date;

// Absolute index from this week's Monday, including dates in following weeks.
const calmDayIndex = (date) => {
  const utc = (value) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return (
    Math.round((utc(date) - utc(calmDateAfter(-calmTodayIndex()))) / 86400000) -
    window.calmWeekOffset * 7
  );
};
