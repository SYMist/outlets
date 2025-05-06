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
        if (row.length < 7 || !row[0] || !row[1]) return;
    
        const rawTitle = row[0].trim(); // A열
        const rawPeriod = row[1].trim(); // B열
        const description = row[6]?.trim() || ""; // G열
    
        // 기간 파싱
        const dates = rawPeriod.split("~");
        const start = dates[0]?.trim().replace(/\./g, "-");
        const end = dates[1]?.trim().replace(/\./g, "-");
    
        // 아울렛명 추출
        const outletMatch = rawTitle.match(/\[(.+?)\]/);
        const outlet = outletMatch ? outletMatch[1] : "기타";
    
        // FullCalendar에 표시할 제목
        const title = rawTitle;
    
        // 중복 제거용 키
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
