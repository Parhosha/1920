const Papa = require("papaparse");
const { CSV_URL } = require("./config");

async function fetchGoogleSheetData() {
    try {
        const response = await fetch(CSV_URL);
        const text = await response.text();

        return new Promise((resolve, reject) => {
            const res =  Papa.parse(text, {
                header: false,
                skipEmptyLines: true,
                complete: function (results) {
                    const rows = results.data;

                    const dayNames = rows[0];
                    const dates = rows[1];

                    const headers = dayNames.map((day, index) => {
                        const date = dates[index] || "";
                        if (day && date) {
                            return date;
                        }
                        return day || date || `col${index}`;
                    });

                    const dataRows = rows.slice(2);
                    const structuredData = dataRows.map((row) => {
                        const obj = {};
                        row.forEach((val, i) => {
                            obj[headers[i].trim()] = val;
                        });
                        return obj;
                    });
                    resolve(structuredData);
                },
                error: (error) => reject(error),
            });
        });
    } catch (error) {
        console.error("Error fetching or parsing data:", error);
        throw error;
    }
}
module.exports = { fetchGoogleSheetData };
