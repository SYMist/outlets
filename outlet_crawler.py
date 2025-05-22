import time
import gspread
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from oauth2client.service_account import ServiceAccountCredentials

# --- Google Sheets 설정
def setup_gspread():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    CREDENTIAL_PATH = os.path.join(BASE_DIR, "credentials.json")
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIAL_PATH, scope)
    client = gspread.authorize(creds)
    return client

# --- 가격 텍스트 처리
def process_price_text(price_text):
    if "정상가" in price_text and "판매가" in price_text:
        try:
            parts = price_text.split("판매가")
            original_price = parts[0].strip()
            sale_price = parts[1].strip()
            return f"<s>{original_price}</s> 판매가 {sale_price}"
        except:
            return price_text
    return price_text

# --- 행사 리스트 API 호출 및 HTML 파싱
def fetch_event_list(branchCd, page):
    url = "https://www.ehyundai.com/newPortal/SN/getSnEvtListJson.do"
    params = {
        "branchCd": branchCd,
        "evtTypeCd": "01",
        "pageIndex": page
    }

    try:
        response = requests.post(url, data=params)
        response.raise_for_status()
        html = response.json()["evtContListHtml"]
        soup = BeautifulSoup(html, "html.parser")
        return soup.select("#eventList > li")
    except Exception as e:
        print(f"리스트 로드 실패: {e}")
        return []

# --- 상세 페이지 파싱
def fetch_event_detail(detail_url):
    try:
        res = requests.get(detail_url)
        soup = BeautifulSoup(res.text, "html.parser")

        title = soup.select_one("section.fixArea h2")
        period = soup.select_one("table.info td")

        noimg_block = soup.select("article.noImgProduct tr")
        noimg_list = [
            f"{row.find('th').text.strip()}: {row.find('td').text.strip()}"
            for row in noimg_block if row.find('th') and row.find('td')
        ]

        product_blocks = soup.select("article.twoProduct figure")
        products = []
        for p in product_blocks:
            brand = p.select_one(".p_brandNm")
            name = p.select_one(".p_productNm")
            price = p.select_one(".p_productPrc")
            img = p.select_one(".p_productImg")
            price_text = price.get_text(" ", strip=True) if price else ""

            products.append({
                "브랜드": brand.text.strip() if brand else "",
                "제품명": name.text.strip() if name else "",
                "가격": process_price_text(price_text),
                "이미지": img["src"] if img else ""
            })

        return {
            "상세 제목": title.text.strip() if title else "",
            "상세 기간": period.text.strip() if period else "",
            "텍스트 설명": noimg_list,
            "상품 리스트": products
        }

    except Exception as e:
        print(f"상세 페이지 파싱 실패: {e}")
        return {"상세 제목": "", "상세 기간": "", "텍스트 설명": [], "상품 리스트": []}

# --- Google Sheet에 업로드
def upload_to_google_sheet(sheet_title, sheet_name, new_rows):
    client = setup_gspread()
    spreadsheet = client.open(sheet_title)
    try:
        worksheet = spreadsheet.worksheet(sheet_name)
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=sheet_name, rows="1000", cols="20")

    headers = ["제목", "기간", "상세 제목", "상세 기간", "썸네일", "상세 링크", "혜택 설명", "브랜드", "제품명", "가격", "이미지", "업데이트"]
    try:
        existing_data = worksheet.get_all_values()
        if existing_data and existing_data[0] == headers:
            existing_data = existing_data[1:]
    except:
        existing_data = []

    existing_links = {row[5] for row in existing_data if len(row) >= 6}
    filtered = [row for row in new_rows if row[5] not in existing_links]

    print(f"{sheet_name} - 신규 {len(filtered)}개 항목 발견")

    if not filtered:
        return

    today = datetime.today().strftime("%Y-%m-%d")
    for row in filtered:
        row.append(today)

    all_data = [headers] + filtered + existing_data
    worksheet.clear()
    worksheet.update('A1', all_data)

# --- 아울렛 별 전체 크롤링
def crawl_outlet(branchCd, sheet_name):
    all_rows = []
    for page in range(1, 5):
        print(f"{sheet_name} - 페이지 {page} 크롤링")
        events = fetch_event_list(branchCd, page)
        if not events:
            continue

        for event in events:
            title_tag = event.select_one(".info_tit")
            period_tag = event.select_one(".info_txt")
            img_tag = event.select_one("img")
            link_tag = event.select_one("a")

            title = title_tag.get_text(" ", strip=True) if title_tag else ""
            period = period_tag.get_text(strip=True) if period_tag else ""
            image_url = img_tag["src"] if img_tag else ""
            detail_url = "https://www.ehyundai.com" + link_tag["href"] if link_tag else ""

            detail = fetch_event_detail(detail_url)
            base_info = [
                title,
                period,
                detail["상세 제목"],
                detail["상세 기간"],
                image_url,
                detail_url,
                " / ".join(detail["텍스트 설명"]),
            ]

            if detail["상품 리스트"]:
                for p in detail["상품 리스트"]:
                    row = base_info + [p["브랜드"], p["제품명"], p["가격"], p["이미지"]]
                    all_rows.append(row)
            else:
                all_rows.append(base_info + ["", "", "", ""])

    upload_to_google_sheet("outlet-data", sheet_name, all_rows)

# --- 메인 실행
def main():
    OUTLET_TARGETS = [
        ("B00174000", "Sheet1"),  # 송도
        ("B00172000", "Sheet2"),  # 김포
        ("B00178000", "Sheet3"),  # 스페이스원
    ]

    for branchCd, sheet_name in OUTLET_TARGETS:
        crawl_outlet(branchCd, sheet_name)

    print("전체 아울렛 크롤링 완료")

if __name__ == "__main__":
    main()
