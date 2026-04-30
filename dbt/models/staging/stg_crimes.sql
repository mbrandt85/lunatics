WITH raw AS (
    SELECT * FROM {{ source('raw_data', 'raw_crimes') }}
)

SELECT
    id,
    type,
    city,
    area,
    timestamp,
    severity,
    link,
    fetch_time
FROM raw
QUALIFY ROW_NUMBER() OVER(PARTITION BY link ORDER BY fetch_time DESC) = 1
