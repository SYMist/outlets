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
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  const filtered = outlet === 'ALL'
    ? rawEvents
    : rawEvents.filter(e => e.outlet === outlet);

  calendar.removeAllEvents();
  filtered.forEach(event => calendar.addEvent(event));
}

function parseSheetData(data) {
  const rows = data.values.slice(1);
  return rows.map(row => {
    const brand = row[11] || '기타';
    const title = `[${brand}] ${row[0] || ''}`;
    const description = row[6] || '';
    const period = row[1] || '';
    const [start, end] = period.includes('~') ? period.split('~').map(p => p.trim().replace(/\./g, '-')) : [null, null];
    
    return {
      title,
      start,
      end,
      description,
      outlet: brand
    };
  });
}

function loadSheetData() {
  const sheetId = '16JLl5-GVDSSQsdMowjZkTAzOmi6qkkz93to_GxMjQ18';
  const apiKey = 'AIzaSyCmZFh6Hm6CU4ucKnRU78v6M3Y8YC_rTw8';
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
