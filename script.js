let calendar;
let rawEvents = [];

function initCalendar(events) {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'ko',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    },
    events: events,
    eventClick: function(info) {
      alert(info.event.title + "\n" + info.event.extendedProps.description);
    }
  });
  calendar.render();
}

function filterEvents(outlet) {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  if (!calendar) return;

  const filtered = outlet === 'ALL'
    ? rawEvents
    : rawEvents.filter(e => e.outlet === outlet);

  calendar.removeAllEvents();
  filtered.forEach(event => calendar.addEvent(event));
}

function parseSheetData(data) {
  const rows = data.values.slice(1); // skip header
  return rows.map(row => {
    const brand = row[11] || '';
    const title = `[${brand}] ${row[0] || ''}`;

    let start = '', end = '';
    if (row[1]) {
      const period = row[1].split('~');
      start = (period[0] || '').trim().replace(/\./g, '-');
      end = (period[1] || '').trim().replace(/\./g, '-');
    }

    return {
      title: title,
      start: start,
      end: end,
      description: row[6] || '',
      outlet: brand
    };
  });
}

function loadSheetData() {
  const sheetId = '16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18'; // 본인 시트 ID로 교체
  const apiKey = 'AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8';       // 본인 API 키로 교체
  const range = 'Sheet1!A2:L';

  gapi.load('client', () => {
    gapi.client.init({ apiKey }).then(() => {
      return gapi.client.request({
        path: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`
      });
    }).then(response => {
      rawEvents = parseSheetData(response.result);
      initCalendar(rawEvents);
    }, err => console.error('Sheet Load Error', err));
  });
}

document.addEventListener('DOMContentLoaded', loadSheetData);
