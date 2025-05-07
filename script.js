document.addEventListener("DOMContentLoaded", function () {
  let calendar;
  let rawEvents = [];

  const SHEET_ID = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18"; // 구글 시트 ID
  const API_KEY = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8"; // API 키
  const SHEET_MAP = {
    Sheet1: "송도",
    Sheet2: "김포",
    Sheet3: "스페이스원"
  };

  function initCalendar(events) {
    const calendarEl = document.getElementById("calendar");
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "ko",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,listMonth"
      },
      events: events,
      eventClick: function (info) {
        const { title, extendedProps } = info.event;
        const { description, items = [] } = extendedProps;

        let content = `<strong>${title}</strong>`;
        if (description) content += `<br><br><strong>혜택:</strong> ${description}`;
        if (items.length > 0) {
          items.forEach((item) => {
            content += `<br><br>${item.replace(/\n/g, "<br>")}`;
          });
        }

        const modal = document.createElement("div");
        modal.innerHTML = `
          <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:20px; border-radius:8px; max-width:400px;">
              ${content}
              <div style="text-align:right; margin-top:20px;">
                <button onclick="this.closest('div').remove()" style="padding:6px 12px;">닫기</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modal);
      }
    });
    calendar.render();
  }

  function filterEvents(outlet) {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    event.target.classList.add("active");

    if (!calendar) return;

    const filtered = outlet === "ALL" ? rawEvents : rawEvents.filter((e) => e.outlet === outlet);
    calendar.removeAllEvents();
    filtered.forEach((event) => calendar.addEvent(event));
  }

  window.filterEvents = filterEvents;

  function normalizeDate(dateStr) {
    const year = new Date().getFullYear();
    const match = dateStr.match(/(\\d{2})\\.(\\d{2})\\(.*?\\)\\s*~\\s*(\\d{2})\\.(\\d{2})/);
    if (!match) return [null, null];
    const [, m1, d1, m2, d2] = match;
    const start = `${year}-${m1.padStart(2, "0")}-${d1.padStart(2, "0")}`;
    const end = `${year}-${m2.padStart(2, "0")}-${(parseInt(d2) + 1).toString().padStart(2, "0")}`;
    return [start, end];
  }

  function parseSheetData(sheetName, data) {
    const outlet = SHEET_MAP[sheetName];
    const rows = data.values.slice(1);
    const eventsMap = new Map();

    rows.forEach((row) => {
      const title = row[0] || "";
      const period = row[1] || "";
      const description = row[6] || "";
      const brand = row[7] || "";
      const productName = row[8] || "";
      const price = row[9] || "";

      const [start, end] = normalizeDate(period);
      if (!start || !end) return;

      const key = `${title}_${period}_${description}_${outlet}`;
      if (!eventsMap.has(key)) {
        eventsMap.set(key, {
          title: `[${outlet}] ${title}`,
          start,
          end,
          description,
          outlet,
          items: []
        });
      }

      const event = eventsMap.get(key);
      if (brand || productName || price) {
        event.items.push(`브랜드: ${brand}\n제품명: ${productName}\n가격: ${price}`);
      }
    });

    return Array.from(eventsMap.values());
  }

  function loadAllSheets() {
    gapi.load("client", () => {
      gapi.client.init({ apiKey: API_KEY }).then(() => {
        const requests = Object.keys(SHEET_MAP).map((sheetName) =>
          gapi.client.request({
            path: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}!A2:K`
          }).then((response) => parseSheetData(sheetName, response.result))
        );

        Promise.all(requests).then((results) => {
          rawEvents = results.flat();
          console.log("📦 최종 이벤트", rawEvents);  // ← 이거 추가
          initCalendar(rawEvents);
        }).catch((err) => console.error("데이터 로드 실패", err));
      });
    });
  }

  loadAllSheets();
});
