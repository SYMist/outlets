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

    const filtered = outlet === "ALL" ? rawEvents : rawEvents.filter((e) => e.outlet === outlet);
    calendar.removeAllEvents();
    filtered.forEach((event) => calendar.addEvent(event));
  }

  window.filterEvents = filterEvents;

  function parseSheetData(data, outletName) {
    const rows = data.values.slice(1);
    const grouped = {};

    for (const row of rows) {
      if (row.length < 11 || !row[0] || !row[1]) continue;

      const [title, period, , , thumbnail, , desc, brand, product, price] = row;
      const dates = period.split("~");
      if (dates.length !== 2) continue;

      const start = parseDate(dates[0]);
      const end = parseDate(dates[1]);
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
          thumbnail,
        };
      }

      grouped[key].items.push({ brand, product, price });
    }

    return Object.values(grouped);
  }

  function parseDate(str) {
    const clean = str.replace(/\([^)]*\)/g, "").trim();
    if (!clean.includes(".")) return null;
    const parts = clean.split(".").map((p) => p.padStart(2, "0"));
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
            gapi.client.request({
              path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${s.name}!A2:K`,
            }).then((response) => parseSheetData(response.result, s.outlet))
          )
        ).then((results) => {
          rawEvents = results.flat();
          initCalendar(rawEvents);
        });
      });
    });
  }

  loadAllSheets();

  function showModal(event) {
    const modal = document.getElementById("event-modal");
    const overlay = document.getElementById("modal-overlay");

    document.getElementById("modal-title").innerText = event.title;

    const thumb = event.extendedProps.thumbnail;
    document.getElementById("modal-thumbnail").src = thumb;

    let html = "";
    if (event.extendedProps.description) {
      html += `<p>${event.extendedProps.description}</p>`;
    }

    event.extendedProps.items.forEach((item) => {
      const hasAnyDetail = item.product || item.brand || item.price;
      if (!hasAnyDetail) return;

      if (item.product) html += `<div><strong>상품명:</strong> ${item.product}</div>`;
      if (item.brand) html += `<div><strong>브랜드:</strong> ${item.brand}</div>`;
      if (item.price) html += `<div><strong>가격:</strong> ${item.price}</div>`;
      if (hasAnyDetail) html += `<hr/>`;
    });

    document.getElementById("modal-desc").innerHTML = html;

    modal.classList.add("show");
    overlay.style.display = "block";
    document.body.style.overflow = "hidden";
  }

  window.closeModal = function () {
    document.getElementById("event-modal").classList.remove("show");
    document.getElementById("modal-overlay").style.display = "none";
    document.body.style.overflow = "auto";
  };

  document.getElementById("modal-overlay").addEventListener("click", closeModal);
});
