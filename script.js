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

  // 버튼 클릭 시 접근 가능하게 전역으로 노출
  window.filterEvents = filterEvents;

  function parseSheetData(data) {
    const rows = data.values.slice(1); // 헤더 제외

    const uniqueEvents = new Map();

    rows.forEach((row) => {
      if (row.length < 7 || !row[0] || !row[1]) return;

      const rawTitle = row[0].trim(); // A열: 제목
      const rawPeriod = row[1].trim(); // B열: 기간
      const description = row[6]?.trim() || ""; // G열: 혜택 설명

      // 기간 파싱
      const dates = rawPeriod.split("~");
      const start = dates[0]?.trim().replace(/\./g, "-");
      const end = dates[1]?.trim().replace(/\./g, "-");

      // 아울렛명 추출
      const outletMatch = rawTitle.match(/\[(.+?)\]/);
      const outlet = outletMatch ? outletMatch[1] : "기타";

      const title = rawTitle;

      // 고유 키로 중복 제거
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

  function loadSheetData() {
    const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18"; // 실제 시트 ID
    const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8"; // 실제 API 키
    const range = "Sheet1!A2:K";

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
            console.log("✅ 로드된 이벤트", rawEvents);
            initCalendar(rawEvents);
          },
          (err) => console.error("❌ 시트 데이터 로딩 실패", err)
        );
    });
  }

  loadSheetData();
});
