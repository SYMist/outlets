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
        const desc = info.event.extendedProps.description;
        alert(info.event.title + "\n\n" + desc);
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

  window.filterEvents = filterEvents;

  function parseDate(text) {
    const match = text.trim().match(/(\d{2})\.(\d{2})/);
    if (!match) return null;
    const year = new Date().getFullYear();
    const month = match[1];
    const day = match[2];
    return `${year}-${month}-${day}`;
  }

  function parseSheetData(data, outletLabel) {
    const rows = data.values.slice(1);
    const uniqueEvents = new Map();

    rows.forEach((row) => {
      if (row.length < 11 || !row[0] || !row[1]) return;

      const rawTitle = row[0].trim();
      const rawPeriod = row[1].trim();
      const benefit = row[6]?.trim() || "";
      const brand = row[7]?.trim() || "";
      const product = row[8]?.trim() || "";
      const price = row[9]?.trim() || "";

      const dates = rawPeriod.split("~");
      const start = parseDate(dates[0]);
      const end = parseDate(dates[1]);

      if (!start || !end) return;

      const title = rawTitle;
      const key = `${title}-${start}-${end}-${outletLabel}`;

      const details = [
        benefit && `혜택: ${benefit}`,
        brand && `브랜드: ${brand}`,
        product && `제품명: ${product}`,
        price && `가격: ${price}`
      ].filter(Boolean).join("\n");

      if (!uniqueEvents.has(key)) {
        uniqueEvents.set(key, {
          title,
          start,
          end,
          description: details,
          outlet: outletLabel,
        });
      } else {
        const existing = uniqueEvents.get(key);
        existing.description += "\n\n" + details;
      }
    });

    return Array.from(uniqueEvents.values());
  }

  function loadAllSheets() {
    const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18";
    const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8";
    const sheetConfigs = [
      { name: "Sheet1", outlet: "송도" },
      { name: "Sheet2", outlet: "김포" },
      { name: "Sheet3", outlet: "스페이스원" },
    ];

    gapi.load("client", () => {
      gapi.client.init({ apiKey }).then(() => {
        const requests = sheetConfigs.map(({ name, outlet }) =>
          gapi.client.request({
            path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${name}!A2:K`,
          }).then((res) => parseSheetData(res.result, outlet))
        );

        Promise.all(requests)
          .then((allEventGroups) => {
            rawEvents = allEventGroups.flat();
            console.log("✅ 모든 시트 이벤트 로드 완료", rawEvents);
            initCalendar(rawEvents);
          })
          .catch((err) => console.error("❌ 시트 데이터 로딩 실패", err));
      });
    });
  }

  loadAllSheets();
});
