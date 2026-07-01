Build a Python application called LeadFinder.

Goal:
Discover North American sheet metal fabrication companies using Brave Search API.

Workflow:

1. Execute search queries.
2. Extract official company website.
3. Crawl only:
   /
   /contact
   /about
   /request-quote
4. Extract:
   - Company Name
   - Website
   - Contact Email
   - Phone Number
   - Contact Page URL
   - RFQ Page URL
5. Export to companies.csv.

Requirements:
- Python 3.12
- Playwright
- BeautifulSoup
- httpx
- pandas
- python-dotenv
- Retry failed requests
- Remove duplicate companies by domain
- Respect robots.txt where practical
- Modular code (search.py, crawler.py, extractor.py, export.py)
- CLI command:
    python main.py
- Output:
    companies.csv