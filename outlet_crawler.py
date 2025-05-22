import requests
import gspread
import os
from datetime import datetime
from oauth2client.service_account import ServiceAccountCredentials

# --- API URL 목록
OUTLET_APIS = {
    "송도": "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7402411320642%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D{}",
    "김포": "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7202505356657%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D{}",
    "스페이스원": "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7802505356730%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D{}"
}

# --- 시트에 업로드
def upload_to_google_sheet(sheet_title, sheet_name, new_rows):
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    CREDENTIAL_PATH = os.path.join(BASE_DIR, "credentials.json")
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIAL_PATH, scope)
    client = gspread.authorize(creds)
    spreadsheet = client.open(sheet_title)

    try:
        worksheet = spreadsheet.worksheet(sheet_name)
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=sheet_name, rows="1000", cols="20")

    headers = ["제목", "기간", "상세 제목", "상세 기간", "썸네일", "상세 링크", "혜택 설명", "브랜드", "제품명", "가격", "이미지", "업데이트 날짜"]

    try:
        existing_data = worksheet.get_all_values()
        if existing_data and existing_data[0] == headers:
            existing_data = existing_data[1:]
    except:
        existing_data = []

    existing_links = {row[5] for row in existing_data if len(row) >= 6}
    filtered_new_rows = [row for row in new_rows if len(row) >= 6 and row[5] not in existing_links]

    print(f"{sheet_name} - 신규 {len(filtered_new_rows)}개 항목 발견")
    if not filtered_new_rows:
        print(f"{sheet_name} - 추가할 데이터 없음")
        return

    today = datetime.today().strftime("%Y-%m-%d")
    for row in filtered_new_rows:
        row.append(today)

    all_data = [headers] + filtered_new_rows + existing_data
    worksheet.clear()
    worksheet.update("A1", all_data)
    print(f"{sheet_name} - 시트 업데이트 완료")

# --- API 데이터 파싱
def fetch_api_data(api_url):
    try:
        all_items = []
        for page in range(1, 6):
            url = api_url.format(page)
            res = requests.get(url)
            res.raise_for_status()
            data = res.json()
            items = data["result"]["items"]
            if not items:
                break
            all_items.extend(items)
        return all_items
    except Exception as e:
        print("❌ API 요청 실패:", e)
        return []

# --- 아울렛 크롤링
def crawl_outlet(outlet_name, api_url, sheet_name):
    print(f"{sheet_name} - 크롤링 시작")
    items = fetch_api_data(api_url)
    if not items:
        print(f"{sheet_name} - 가져온 항목 없음")
        return

    new_rows = []
    for item in items:
        title = item.get("evntCrdNm", "").replace("\r", " ").replace("\n", " ").strip()
        start = item.get("evntStrtDt", "")[:8]
        end = item.get("evntEndDt", "")[:8]
        period = f"{format_date(start)} ~ {format_date(end)}" if start and end else ""

        thumbnail = "https://www.ehyundai.com/" + item.get("imgPath2", "")
        detail_link = f"https://www.ehyundai.com/newPortal/SN/SN_0101000.do?evntCrdCd={item.get('evntCrdCd')}"
        desc = item.get("evntPlceNm", "") or item.get("evntFlrCd", {}).get("label", "")
        row = [title, period, "", "", thumbnail, detail_link, desc, "", "", "", ""]
        new_rows.append(row)

    upload_to_google_sheet("outlet-data", sheet_name, new_rows)

def format_date(date_str):
    try:
        return f"{date_str[:4]}.{date_str[4:6]}.{date_str[6:8]}"
    except:
        return ""

# --- 메인 실행
def main():
    print("크롤링 시작:", datetime.now())
    OUTLET_TARGETS = [
        ("송도", OUTLET_APIS["송도"], "Sheet1"),
        ("김포", OUTLET_APIS["김포"], "Sheet2"),
        ("스페이스원", OUTLET_APIS["스페이스원"], "Sheet3"),
    ]

    for outlet_name, api_url, sheet_name in OUTLET_TARGETS:
        crawl_outlet(outlet_name, api_url, sheet_name)

    print("전체 크롤링 완료:", datetime.now())

if __name__ == "__main__":
    main()
