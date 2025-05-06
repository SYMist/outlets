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
  function filterEvents(outlet, e) {
    document
    .querySelectorAll(".filter-btn")
    .forEach((btn) => btn.classList.remove("active"));
  e.target.classList.add("active");
    
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
  const rows = data.values.slice(1); // 헤더 제외

  const uniqueEvents = new Map();

  rows.forEach((row) => {
    if (row.length < 12 || !row[0] || !row[1] || !row[11]) return;

    const title = `[${row[11]}] ${row[0]}`;
    const dates = row[1].split("~");
    const start = dates[0]?.trim().replace(/\./g, "-");
    const end = dates[1]?.trim().replace(/\./g, "-");
    const description = row[6] || ""; // 혜택 설명
    const outlet = row[11];

    // 이벤트 고유 키 구성: 지점명 + 제목 + 기간
    const key = `${title}-${start}-${end}`;

    if (!uniqueEvents.has(key)) {
      uniqueEvents.set(key, {
        title,
        start,
        end,
        description,
        outlet,
      });
    }
  });

  return Array.from(uniqueEvents.values());
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
            console.log("✅ 로드된 이벤트", rawEvents); // 이 줄 추가
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
