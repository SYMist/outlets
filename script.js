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
      eventClick: function (info) {
        const items = info.event.extendedProps.items || [];
        const description = info.event.extendedProps.description || "";

        let html = `<strong>${info.event.title}</strong><br><br>`;
        html += `<p>${description}</p>`;

        items.forEach((item) => {
          html += `<hr>`;
          html += `<p><strong>상품:</strong> ${item.product || "-"}</p>`;
          html += `<p><strong>브랜드:</strong> ${item.brand || "-"}</p>`;
          html += `<p><strong>가격:</strong> ${item.price || "-"}</p>`;
        });

        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = `
          <div class="modal-content">
            ${html}
            <button onclick="this.parentElement.parentElement.remove()">닫기</button>
          </div>
        `;
        document.body.appendChild(modal);
      },
    });

    events.forEach((e) => calendar.addEvent(e));
    calendar.render();
  }

  function filterEvents(outlet) {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    event.target.classList.add("active");

    if (!calendar) return;

    const filtered = outlet === "ALL" ? rawEvents : rawEvents.filter((e) => e.outlet === outlet);

    calendar.removeAllEvents();
    filtered.forEach((e) => calendar.addEvent(e));
  }

  window.filterEvents = filterEvents;

  function normalizeDate(dateStr) {
    const year = new Date().getFullYear();
    const match = dateStr.match(/(\d{2})\.(\d{2})\([^)]*\)\s*~\s*(\d{2})\.(\d{2})/);
    if (!match) {
      console.warn("❌ 날짜 파싱 실패:", dateStr);
      return [null, null];
    }
    const [, m1, d1, m2, d2] = match;
    const start = `${year}-${m1}-${d1}`;
    const endDate = new Date(`${year}-${m2}-${d2}`);
    endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString().slice(0, 10);
    return [start, end];
  }

  function parseSheetData(data, outletName) {
    const rows = data.values.slice(1); // skip header

    const grouped = {};

    rows.forEach((row) => {
      const title = row[0]?.trim();
      const dateRange = row[1]?.trim();
      const description = row[6]?.trim();
      const brand = row[7]?.trim();
      const product = row[8]?.trim();
      const price = row[9]?.trim();

      if (!title || !dateRange) return;
      const key = `${title}_${dateRange}`;
      if (!grouped[key]) {
        const [start, end] = normalizeDate(dateRange);
        if (!start || !end) return;

        grouped[key] = {
          title: title,
          start,
          end,
          description,
          outlet: outletName,
          items: [],
        };
      }

      grouped[key].items.push({ brand, product, price });
    });

    return Object.values(grouped);
  }

  function loadAllSheets() {
    const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18";
    const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8";
    const sheetInfo = [
      { range: "Sheet1!A2:K", outlet: "송도" },
      { range: "Sheet2!A2:K", outlet: "김포" },
      { range: "Sheet3!A2:K", outlet: "스페이스원" },
    ];

    gapi.load("client", () => {
      gapi.client
        .init({ apiKey })
        .then(() => {
          return Promise.all(
            sheetInfo.map((sheet) =>
              gapi.client.request({
                path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheet.range}`,
              }).then((res) => parseSheetData(res.result, sheet.outlet))
            )
          );
        })
        .then((results) => {
          rawEvents = results.flat();
          console.log("📦 최종 이벤트", rawEvents);
          initCalendar(rawEvents);
        })
        .catch((err) => console.error("🚨 데이터 불러오기 실패:", err));
    });
  }

  loadAllSheets();
});
