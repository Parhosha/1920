function getNextDayDateString() {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Add one day to the current date
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
}

function getNamesForNextDay(dataArray) {
    const formattedNextDay = getNextDayDateString();
    return dataArray
        .filter(row => row[formattedNextDay] === '1')
        .map(row => `👤 ${row['Імя']} - 🚓 ${row['Адреса']} \n\n`);
}

module.exports = { getNamesForNextDay }