import requests
import gspread
import os
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime

def get_today_str():
    return datetime.now().strftime("%Y-%m-%d")

# ✅ 행사 데이터 추출
def fetch_events(api_url, outlet_name):
    page = 1
    all_items = []

    while True:
        url = api_url.replace("page=1", f"page={page}")
        try:
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            data = res.json()["result"]
        except Exception as e:
            print(f"{outlet_name} - 페이지 {page} 요청 실패: {e}")
            break

        items = data.get("items", [])
        if not items:
            break

        all_items.extend(items)
        if page >= data.get("pageCount", 1):
            break
        page += 1

    print(f"{outlet_name} - 총 {len(all_items)}개 항목 수집 완료")
    return all_items

# ✅ 시트에 저장
def upload_to_google_sheet(sheet_title, sheet_name, events):
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
    client = gspread.authorize(creds)

    try:
        sheet = client.open(sheet_title).worksheet(sheet_name)
    except gspread.exceptions.WorksheetNotFound:
        sheet = client.open(sheet_title).add_worksheet(title=sheet_name, rows="1000", cols="20")

    headers = ["제목", "기간", "상세 제목", "상세 기간", "썸네일", "상세 링크", "혜택 설명", "브랜드", "제품명", "가격", "이미지", "업데이트 날짜"]
    today = get_today_str()

    new_rows = []
    for ev in events:
        title = ev.get("evntCrdNm", "").replace("\r", "").replace("\n", " ").strip()
        start = ev.get("evntStrtDt", "")[:8]
        end = ev.get("evntEndDt", "")[:8]
        period = f"{start[:4]}.{start[4:6]}.{start[6:8]} ~ {end[:4]}.{end[4:6]}.{end[6:8]}"
        thumb_path = ev.get("imgPath2", "")
        thumbnail = f"https://imgprism.ehyundai.com/{thumb_path}" if thumb_path else ""
        link = f"https://www.ehyundai.com/newPortal/dp/st/sm/CP_10000000001.hd?evntCrdCd={ev.get('evntCrdCd', '')}"

        row = [title, period, "", "", thumbnail, link, "", "", "", "", "", today]
        new_rows.append(row)

    sheet.clear()
    sheet.update("A1", [headers] + new_rows)
    print(f"{sheet_name} 시트에 총 {len(new_rows)}개 저장 완료")

# ✅ 실행
def main():
    OUTLET_API_URLS = [
        ("송도", "Sheet1", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7402411320642%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1"),
        ("김포", "Sheet2", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7202505356657%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1"),
        ("스페이스원", "Sheet3", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7802505356730%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1")
    ]

    for outlet, sheet, url in OUTLET_API_URLS:
        events = fetch_events(url, outlet)
        upload_to_google_sheet("outlet-data", sheet, events)

    print("✅ 전체 완료")

if __name__ == "__main__":
    main()
