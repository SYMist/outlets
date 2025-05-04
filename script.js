document.addEventListener("DOMContentLoaded", function () {
  let calendar;
  let rawEvents = [];

  function initCalendar(events) {
    const calendarEl = document.getElementById("calendar");
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "ko",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,listMonth",
      },
      events: events,
      eventClick: function (info) {
        alert(info.event.title + "\n" + info.event.extendedProps.description);
      },
    });
    calendar.render();
  }

  function filterEvents(outlet) {
    document
      .querySelectorAll(".filter-btn")
      .forEach((btn) => btn.classList.remove("active"));
    event.target.classList.add("active");

    if (!calendar) return;

    const filtered =
      outlet === "ALL"
        ? rawEvents
        : rawEvents.filter((e) => e.outlet === outlet);

    calendar.removeAllEvents();
    filtered.forEach((event) => calendar.addEvent(event));
  }

  // filterEvents 함수 전역에 노출 (버튼에서 호출 가능하도록)
  window.filterEvents = filterEvents;

  function parseSheetData(data) {
    const rows = data.values.slice(1); // skip header

    return rows
      .filter((row) => row.length >= 12 && row[0] && row[1]) // 필수 필드 있는 것만
      .map((row) => {
        const title = `[${row[11]}] ${row[0]}`;
        const dates = row[1].split("~");
        const start = dates[0].trim().replace(/\./g, "-");
        const end = dates[1]?.trim().replace(/\./g, "-");

        return {
          title,
          start,
          end,
          description: row[6] || "",
          outlet: row[11] || "기타",
        };
      });
  }

  function loadSheetData() {
    const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18"; // 실제 시트 ID로 교체
    const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8"; // 실제 키로 교체
    const range = "Sheet1!A2:L";

    gapi.load("client", () => {
      gapi.client
        .init({ apiKey })
        .then(() => {
          return gapi.client.request({
            path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
          });
        })
        .then(
          (response) => {
            rawEvents = parseSheetData(response.result);
            initCalendar(rawEvents);
          },
          (err) => console.error("Sheet Load Error", err)
        );
    });
  }

  loadSheetData();
});
