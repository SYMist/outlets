document.addEventListener("DOMContentLoaded", function () {
  let calendar;
  let rawEvents = [];

  const sheetConfigs = [
    { sheetName: "Sheet1", outlet: "송도" },
    { sheetName: "Sheet2", outlet: "김포" },
    { sheetName: "Sheet3", outlet: "스페이스원" },
  ];

  function isValidFullDateRange(str) {
    const regex = /^\s*\d{4}\.\d{1,2}\.\d{1,2}\s*~\s*\d{4}\.\d{1,2}\.\d{1,2}\s*$/;
    return regex.test(str);
  }

  function formatToISO(dateStr) {
    const parts = dateStr.trim().split(".");
    const yyyy = parts[0];
    const mm = parts[1].padStart(2, "0");
    const dd = parts[2].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseSheetData(data, outletName) {
    const rows = data.values.slice(1); // skip header
    const eventMap = new Map();

    rows.forEach((row) => {
      if (row.length < 11 || !row[0] || !row[1]) return;

      const key = row[0] + "|" + row[1];

      if (!eventMap.has(key)) {
        const rawPeriod = row[1];
        if (!isValidFullDateRange(rawPeriod)) {
          console.warn("⛔️ 날짜 파싱 제외 대상:", rawPeriod);
          return;
        }

        const [startRaw, endRaw] = rawPeriod.split("~").map((s) => s.trim());
        const start = formatToISO(startRaw);
        const end = formatToISO(endRaw);

        eventMap.set(key, {
          title: `[${outletName}] ${row[0]}`,
          start,
          end,
          description: row[6] ? `혜택: ${row[6]}` : "",
          outlet: outletName,
          items: [],
        });
      }

      const event = eventMap.get(key);
      const brand = row[7]?.trim();
      const product = row[8]?.trim();
      const price = row[9]?.trim();
      if (brand || product || price) {
        event.items.push({ brand, product, price });
      }
    });

    return Array.from(eventMap.values()).map((event) => {
      if (event.items.length > 0) {
        const itemDetails = event.items
          .map((i) => {
            let line = "";
            if (i.brand) line += `브랜드: ${i.brand}\n`;
            if (i.product) line += `제품명: ${i.product}\n`;
            if (i.price) line += `가격: ${i.price}\n`;
            return line.trim();
          })
          .join("\n\n");

        event.description = [event.description, itemDetails].filter(Boolean).join("\n\n");
      }
      delete event.items;
      return event;
    });
  }

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
        showModal(info.event.title, info.event.extendedProps.description);
      },
    });
    calendar.render();
  }

  function showModal(title, content) {
    let modal = document.getElementById("eventModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "eventModal";
      modal.style = `position: fixed; top: 20%; left: 50%; transform: translateX(-50%); background: white; border-radius: 10px; padding: 20px; width: 80%; max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 9999; white-space: pre-wrap;`;
      modal.innerHTML = `<h3 id='modalTitle'></h3><p id='modalContent'></p><div style='text-align:right'><button onclick='document.getElementById("eventModal").remove()'>닫기</button></div>`;
      document.body.appendChild(modal);
    }
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalContent").innerText = content;
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

  async function loadAllSheets() {
    const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18";
    const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8";

    await gapi.load("client", async () => {
      await gapi.client.init({ apiKey });

      const promises = sheetConfigs.map((cfg) =>
        gapi.client.request({
          path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${cfg.sheetName}!A2:K`,
        }).then((response) => parseSheetData(response.result, cfg.outlet))
      );

      const results = await Promise.all(promises);
      rawEvents = results.flat();
      console.log("📦 최종 이벤트", rawEvents);
      initCalendar(rawEvents);
    });
  }

  loadAllSheets();
});
