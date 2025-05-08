document.addEventListener("DOMContentLoaded", function () {
  let calendar;
  let rawEvents = [];
  let filteredOutlet = "ALL";

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
        showModal(info.event);
      },
    });
    calendar.render();
  }

  function filterEvents(outlet) {
    filteredOutlet = outlet;
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    event.target.classList.add("active");

    if (!calendar) return;

    const filtered =
      outlet === "ALL" ? rawEvents : rawEvents.filter((e) => e.outlet === outlet);

    calendar.removeAllEvents();
    filtered.forEach((event) => calendar.addEvent(event));
  }

  window.filterEvents = filterEvents;

  function parseSheetData(data, outletName) {
    const rows = data.values.slice(1); // skip header

    const grouped = {};

    for (const row of rows) {
      if (row.length < 11 || !row[0] || !row[1]) continue;

      const title = row[0];
      const period = row[1];
      const desc = row[6] || "";
      const brand = row[7] || "";
      const product = row[8] || "";
      const price = row[9] || "";

      const dates = period.split("~");
      if (dates.length !== 2) continue;
      const startRaw = dates[0].trim();
      const endRaw = dates[1].trim();

      const start = parseDate(startRaw);
      const end = parseDate(endRaw);

      if (!start || !end) {
        console.log("❌ 날짜 파싱 제외 대상:", period);
        continue;
      }

      const key = `${title}_${start}_${end}`;
      if (!grouped[key]) {
        grouped[key] = {
          title: `[${outletName}] ${title}`,
          start,
          end,
          description: desc,
          outlet: outletName,
          items: [],
        };
      }

      grouped[key].items.push({ brand, product, price });
    }

    return Object.values(grouped);
  }

  function parseDate(str) {
    const clean = str.replace(/\([^)]*\)/g, "").trim();
    const full = clean.includes(".") ? clean : null;
    if (!full) return null;

    const parts = full.split(".").map((p) => p.padStart(2, "0"));
    if (parts.length !== 2) return null;

    const [month, day] = parts;
    return `2025-${month}-${day}`;
  }

  function loadAllSheets() {
    const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18";
    const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8";
    const sheets = [
      { name: "Sheet1", outlet: "송도" },
      { name: "Sheet2", outlet: "김포" },
      { name: "Sheet3", outlet: "스페이스원" },
    ];

    gapi.load("client", () => {
      gapi.client.init({ apiKey }).then(() => {
        Promise.all(
          sheets.map((s) =>
            gapi.client
              .request({
                path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${s.name}!A2:K`,
              })
              .then((response) => parseSheetData(response.result, s.outlet))
          )
        ).then((results) => {
          rawEvents = results.flat();
          console.log("📦 최종 이벤트", rawEvents);
          initCalendar(rawEvents);
        });
      });
    });
  }

  loadAllSheets();

  // 🧩 모달 로직 추가
  function showModal(event) {
    const modal = document.getElementById("event-modal");
    const overlay = document.getElementById("modal-overlay");

    document.getElementById("modal-title").innerText = event.title;

    let html = "";
    html += `<p>${event.extendedProps.description}</p>`;
    event.extendedProps.items.forEach((item) => {
      html += `<div><strong>상품명:</strong> ${item.product}</div>`;
      if (item.brand) {
        html += `<div><strong>브랜드:</strong> ${item.brand}</div>`;
      }
      html += `<div><strong>가격:</strong> ${item.price}</div><hr/>`;
    });

    document.getElementById("modal-desc").innerHTML = html;
    overlay.style.display = "block";
    modal.style.display = "block";
  }

  window.closeModal = function () {
    document.getElementById("event-modal").style.display = "none";
    document.getElementById("modal-overlay").style.display = "none";
  };

  document.getElementById("modal-overlay").addEventListener("click", closeModal);
});
