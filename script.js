document.addEventListener("DOMContentLoaded", function () {
  let calendar;
  let rawEvents = [];

  const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18";
  const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8";
  const range = "Sheet1!A2:L";

  // 1️⃣ FullCalendar 초기화
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
        const { title, extendedProps } = info.event;
        alert(`${title}\n${extendedProps.description || ""}`);
      },
    });
    calendar.render();
  }

  // 2️⃣ 이벤트 필터링
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
    calendar.addEventSource(filtered);
  }

  // 전역 노출 (버튼에서 접근 가능)
  window.filterEvents = filterEvents;

  // 3️⃣ 시트 데이터 → 이벤트 객체로 파싱
  function parseSheetData(data) {
    const rows = data.values;
    if (!rows || rows.length < 1) return [];

    return rows
      .filter((row) => row.length >= 12 && row[0] && row[1]) // title, date 필수
      .map((row) => {
        const [titleRaw, dateRange, , , , , description, , , , , outlet] = row;
        const [start, end] = dateRange.split("~").map((d) => d.trim().replace(/\./g, "-"));

        return {
          title: `[${outlet || "기타"}] ${titleRaw}`,
          start,
          end: end || undefined,
          description: description || "",
          outlet: outlet || "기타",
        };
      });
  }

  // 4️⃣ 구글 시트 불러오기
  function loadSheetData() {
    gapi.load("client", () => {
      gapi.client
        .init({ apiKey })
        .then(() =>
          gapi.client.request({
            path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
          })
        )
        .then(
          (response) => {
            rawEvents = parseSheetData(response.result);
            initCalendar(rawEvents);
          },
          (error) => {
            console.error("🛑 Google Sheet API Error:", error);
          }
        );
    });
  }

  // 5️⃣ 캘린더 시작
  loadSheetData();
});
