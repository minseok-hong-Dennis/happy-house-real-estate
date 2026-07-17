# Real Estate Price Sync

한국어 키 발급 및 GitHub Secret 등록 방법은 [API_KEYS_SETUP.md](API_KEYS_SETUP.md)를 참고하세요.

## Schedule

`.github/workflows/sync-home-price.yml` runs once a day at 14:00 KST (`05:00 UTC`) and can also be run manually from the GitHub Actions page.

## Official recent transaction prices

The workflow uses the Ministry of Land, Infrastructure and Transport apartment transaction API for the last three months of reported apartment sales. It also refreshes the latest reported transaction from the last 12 months for each Reconstruction target. Add the following GitHub Actions secret before the first successful sync:

- `MOLIT_SERVICE_KEY`: The `General authentication key (Decoding)` shown under `My Page > Data Utilization > Open API > Application Status` after applying for Public Data Portal dataset `15126469`.

The target apartment is `힐스테이트 푸르지오 수원` in `경기도 수원시 팔달구` (`LAWD_CD=41115`). Reconstruction price targets are managed in `data/reconstruction.json` and include the Suwon Yeongtong 2 district, Gwacheon Jugong 10, Sanbon 11 district, and Bundang Yangji village.

## Current listings

The official Naver Developers API catalog does not provide a Naver Real Estate listings API. Do not configure an unauthorized crawler for Naver Real Estate. Configure a separately contracted provider that allows automated retrieval instead:

- `LISTINGS_API_URL`: HTTPS endpoint returning either an array or an object with `items` or `listings`.
- `LISTINGS_API_TOKEN`: Optional bearer token for the endpoint.
- `LISTINGS_SOURCE_NAME`: Name displayed in the website.

Each listings item should contain `priceManwon` and can optionally contain `title`, `tradeType`, `areaSqm`, and `floor`.
