import urllib.parse
import requests
import time
import gspread
import os
from datetime import datetime
from oauth2client.service_account import ServiceAccountCredentials

# --- API 응답에서 이벤트 목록 가져오기
def fetch_event_list(api_url_template, page):
    parsed_url = urllib.parse.urlparse(api_url_template)
    query_dict = urllib.parse.parse_qs(parsed_url.query)

    param_str = query_dict.get("param", [""])[0]
    param_items = param_str.split("%26")  # %26 = &
    new_param_items = []
    for item in param_items:
        if item.startswith("page%3D"):
            new_param_items.append(f"page%3D{page}")
        else:
            new_param_items.append(item)
    new_param = "%26".join(new_param_items)

    new_query = f"apiID=ifAppHdcms012&param={new_param}"
    new_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}?{new_query}"

    try:
        response = requests.get(new_url)
        response.raise_for_status()
        return response.json()["result"]["items"]
    except Exception as e:
        print(f"[ERROR] {page}페이지 요청 실패: {e}")
        return []

# --- Google Sheets에 업로드
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

    print(f"[{sheet_name}] 신규 {len(filtered_new_rows)}개 항목 발견")
    if not filtered_new_rows:
        print(f"[{sheet_name}] 추가할 데이터 없음.")
        return

    all_data = [headers] + filtered_new_rows + existing_data
    worksheet.clear()
    worksheet.update('A1', all_data)
    print(f"[{sheet_name}] 저장 완료 - 총 {len(all_data)-1}개")

# --- 아울렛 크롤링
def crawl_outlet(api_url, sheet_name):
    new_rows = []
    today_str = datetime.today().strftime("%Y-%m-%d")

    for page in range(1, 5):
        print(f"{sheet_name} - 페이지 {page} 크롤링")
        items = fetch_event_list(api_url, page)
        if not items:
            print(f"{sheet_name} - 페이지 {page} 항목 없음")
            continue

        for ev in items:
            if ev.get("expsEvntYn", {}).get("value") != "Y":
                continue

            title = ev.get("evntCrdNm", "").replace("\r\n", " ").replace("\n", " ").strip()
            start_raw = ev.get("evntStrtDt", "")[:8]
            end_raw = ev.get("evntEndDt", "")[:8]
            period = f"{format_date(start_raw)} ~ {format_date(end_raw)}" if start_raw and end_raw else ""

            thumbnail = f"https://imgprism.ehyundai.com/{ev.get('imgPath2')}" if ev.get("imgPath2") else ""
            detail_url = f"https://www.ehyundai.com/pt/event/detail.do?evtCd={ev.get('evntCrdCd')}"

            new_rows.append([
                title,
                period,
                title,
                period,
                thumbnail,
                detail_url,
                "", "", "", "", "",
                today_str
            ])

    upload_to_google_sheet("outlet-data", sheet_name, new_rows)

# --- 날짜 포맷 변환
def format_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y%m%d").strftime("%Y.%m.%d")
    except:
        return ""

# --- 메인 실행
def main():
    OUTLET_TARGETS = [
        ("https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7402411320642%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1", "Sheet1"),
        ("https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7202505356657%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1", "Sheet2"),
        ("https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7802505356730%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1", "Sheet3"),
    ]

    for api_url, sheet_name in OUTLET_TARGETS:
        crawl_outlet(api_url, sheet_name)

    print("전체 아울렛 크롤링 완료")

# --- 실행
if __name__ == "__main__":
    main()
