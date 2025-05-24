import time
import os
import gspread
import requests
from datetime import datetime
from urllib.parse import urlencode
from oauth2client.service_account import ServiceAccountCredentials

# 썸네일 주소 포맷 변환
def format_thumbnail_url(img_path):
    if not img_path:
        return ""
    if img_path.startswith("derivedImage/fileValue/"):
        return "https://imgprism.ehyundai.com/" + img_path
    return "https://www.ehyundai.com/" + img_path

# 날짜 포맷 변환
def format_date_range(start, end):
    def format_one(d):
        return f"{d[:4]}.{d[4:6]}.{d[6:8]}"
    try:
        return f"{format_one(start)} ~ {format_one(end)}"
    except:
        return ""

# Google Sheets 업로드
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

    print(f"[{sheet_name}] 새로 추가할 항목 수: {len(filtered_new_rows)}개")
    if not filtered_new_rows:
        print(f"[{sheet_name}] 추가할 데이터 없음.")
        return

    all_data = [headers] + filtered_new_rows + existing_data
    worksheet.clear()
    worksheet.update('A1', all_data)
    print(f"[{sheet_name}] 총 {len(all_data)-1}개 데이터 저장 완료.")

# 하나의 아울렛 크롤링
def crawl_outlet(outlet_name, base_url, sheet_name):
    print(f"[{sheet_name}] 크롤링 시작")
    page = 1
    new_rows = []
    today = datetime.today().strftime("%Y-%m-%d")

    while True:
        url = base_url.replace("page=1", f"page={page}")
        try:
            res = requests.get(url)
            res.raise_for_status()
            data = res.json().get("result", {})
            items = data.get("items", [])
            if not items:
                break
        except Exception as e:
            print(f"[{sheet_name}] 페이지 {page} 크롤링 실패: {e}")
            break

        for item in items:
            title = item.get("evntCrdNm", "").replace("\r\n", " ").strip()
            period = format_date_range(item.get("evntStrtDt", ""), item.get("evntEndDt", ""))
            thumbnail = format_thumbnail_url(item.get("imgPath2") or item.get("imgPath"))
            detail_url = f"https://www.ehyundai.com/StoryCard?eventCode={item.get('evntCrdCd')}"
            benefit = item.get("evntPlceNm", "")
            brand, product, price, image = "", "", "", ""

            row = [title, period, "", "", thumbnail, detail_url, benefit, brand, product, price, image, today]
            new_rows.append(row)

        page += 1

    upload_to_google_sheet("outlet-data", sheet_name, new_rows)

# 메인
def main():
    OUTLET_TARGETS = [
        ("송도", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=" + urlencode({
            "mblDmCd": "D7402411320642",
            "evntCrdTypeCd": "01",
            "pageSize": 9,
            "page": 1
        }), "Sheet1"),
        ("김포", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=" + urlencode({
            "mblDmCd": "D7202505356657",
            "evntCrdTypeCd": "01",
            "pageSize": 9,
            "page": 1
        }), "Sheet2"),
        ("스페이스원", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=" + urlencode({
            "mblDmCd": "D7802505356730",
            "evntCrdTypeCd": "01",
            "pageSize": 9,
            "page": 1
        }), "Sheet3"),
    ]

    for name, url, sheet in OUTLET_TARGETS:
        crawl_outlet(name, url, sheet)

    print("전체 아울렛 크롤링 완료.")

if __name__ == "__main__":
    main()
