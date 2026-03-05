const convertMsToMinutesSeconds = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (seconds < 0) {
    return "00:60";
  }
  return secs === 60
    ? `${minutes < 9 ? "0" : ""}${minutes + 1}:00`
    : `${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
};

export { convertMsToMinutesSeconds };
