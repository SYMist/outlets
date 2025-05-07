document.addEventListener("DOMContentLoaded", function () {
  let calendar;
  let allRawEvents = [];
  const calendarEl = document.getElementById("calendar");
  const sheetMap = [
    { sheet: "Sheet1", outlet: "송도" },
    { sheet: "Sheet2", outlet: "김포" },
    { sheet: "Sheet3", outlet: "스페이스원" },
  ];

  function initCalendar(events) {
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
        const event = info.event;
        const items = event.extendedProps.items || [];
        const content = `
          <strong>${event.title}</strong><br><br>
          <div>${event.extendedProps.description || ""}</div>
          <br>
          ${items
            .map(
              (item) => `
                <div style="margin-bottom:10px">
                  <div>상품명: ${item.name}</div>
                  <div>브랜드: ${item.brand}</div>
                  <div>가격: ${item.price}</div>
                </div>
              `
            )
            .join("")}
        `;

        const modal = document.createElement("div");
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100vw";
        modal.style.height = "100vh";
        modal.style.background = "rgba(0,0,0,0.5)";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.innerHTML = `
          <div style="background:white; padding:20px; max-width:500px; max-height:80vh; overflow:auto; border-radius:8px">
            ${content}
            <div style="text-align:right; margin-top:20px">
              <button onclick="this.closest('div').parentElement.remove()">닫기</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      },
    });
    calendar.render();
  }

  function filterEvents(outlet) {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    event.target.classList.add("active");

    const filtered =
      outlet === "ALL" ? allRawEvents : allRawEvents.filter((e) => e.outlet === outlet);

    calendar.removeAllEvents();
    filtered.forEach((event) => calendar.addEvent(event));
  }

  window.filterEvents = filterEvents;

  function parsePeriodString(period) {
    const match = period.match(/(\d{1,2})\.(\d{1,2})\(.*?\)\s*~\s*(\d{1,2})\.(\d{1,2})\(.*?\)/);
    if (!match) return null;
    const [_, sM, sD, eM, eD] = match;
    const year = "2025";
    return {
      start: `${year}-${sM.padStart(2, "0")}-${sD.padStart(2, "0")}`,
      end: `${year}-${eM.padStart(2, "0")}-${eD.padStart(2, "0")}`,
    };
  }

  function parseSheetData(data, outletName) {
    const rows = data.values.slice(1); // skip header
    const grouped = new Map();

    for (const row of rows) {
      if (row.length < 11) continue;
      const key = row[0] + row[1] + outletName;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }

    const events = [];
    for (const group of grouped.values()) {
      const [title, period, , , , , desc] = group[0];
      const date = parsePeriodString(period);
      if (!date) {
        console.warn("날짜 파싱 제외 대상:", period);
        continue;
      }

      const items = group.map((r) => ({
        brand: r[7] || "",
        name: r[8] || "",
        price: r[9] || "",
      }));

      events.push({
        title,
        start: date.start,
        end: date.end,
        description: desc,
        items,
        outlet: outletName,
      });
    }
    return events;
  }

  function loadAllSheets() {
    const sheetId = "16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18";
    const apiKey = "AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8";

    gapi.load("client", () => {
      gapi.client.init({ apiKey }).then(() => {
        const promises = sheetMap.map(({ sheet, outlet }) => {
          return gapi.client.request({
            path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheet}!A2:K`,
          }).then((res) => parseSheetData(res.result, outlet));
        });

        Promise.all(promises).then((allData) => {
          allRawEvents = allData.flat();
          console.log("📦 최종 이벤트", allRawEvents);
          initCalendar(allRawEvents);
        });
      });
    });
  }

  loadAllSheets();
});
