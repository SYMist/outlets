import requests
import gspread
import os
from datetime import datetime
from oauth2client.service_account import ServiceAccountCredentials

# --- Google Sheets 인증 및 업데이트
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

    headers = ["제목", "기간", "상세 제목", "상세 기간", "썸네일", "상세 링크", "혜택 설명", "브랜드", "제품명", "가격", "이미지"]

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
    print(f"[{sheet_name}] 시트 저장 완료")

# --- 날짜 문자열 변환
def parse_date(dt_str):
    try:
        return datetime.strptime(dt_str[:8], "%Y%m%d").strftime("%Y.%m.%d")
    except:
        return ""

# --- 단일 아울렛 크롤링
def crawl_outlet_api(outlet_name, sheet_name, base_url):
    page = 1
    all_rows = []

    while True:
        url = base_url.replace("page=1", f"page={page}")
        try:
            res = requests.get(url)
            res.raise_for_status()
            data = res.json()
            items = data.get("result", {}).get("items", [])
            if not items:
                break

            for item in items:
                title = item.get("evntCrdNm", "").replace("\r", "").replace("\n", " ").strip()
                start_date = parse_date(item.get("evntStrtDt", ""))
                end_date = parse_date(item.get("evntEndDt", ""))
                period = f"{start_date} ~ {end_date}" if start_date and end_date else ""
                detail_title = title
                detail_period = period
                thumbnail = "https://www.ehyundai.com/" + item.get("imgPath2", "")
                detail_url = f"https://www.ehyundai.com/newPortal/SP/SP_0201000.do?evntCrdCd={item.get('evntCrdCd', '')}"
                desc = f"{item.get('evntFlrCd', {}).get('label', '')} / {item.get('evntPlceNm', '')}".strip(" /")
                update = datetime.today().strftime("%Y-%m-%d")

                row = [
                    title,
                    period,
                    detail_title,
                    detail_period,
                    thumbnail,
                    detail_url,
                    desc,
                    "", "", "", ""  # 브랜드, 제품명, 가격, 이미지 (상세 페이지 없으면 비움)
                ]
                all_rows.append(row)
            page += 1
        except Exception as e:
            print(f"[{sheet_name}] {page}페이지 처리 실패: {e}")
            break

    upload_to_google_sheet("outlet-data", sheet_name, all_rows)

# --- 메인 실행
def main():
    OUTLET_TARGETS = [
        ("송도", "Sheet1", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7402411320642%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1"),
        ("김포", "Sheet2", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7202505356657%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1"),
        ("스페이스원", "Sheet3", "https://www.ehyundai.com/newPortal/SN/GetCmsContentsAJX.do?apiID=ifAppHdcms012&param=mblDmCd%3DD7802505356730%26evntCrdTypeCd%3D01%26pageSize%3D9%26page%3D1")
    ]

    for outlet, sheet_name, base_url in OUTLET_TARGETS:
        print(f"{sheet_name} 크롤링 시작")
        crawl_outlet_api(outlet, sheet_name, base_url)

    print("전체 아울렛 크롤링 완료")

if __name__ == "__main__":
    main()
