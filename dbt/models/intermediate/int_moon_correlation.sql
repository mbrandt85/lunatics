WITH crimes AS (
    SELECT 
        CAST(timestamp AS DATE) AS event_date,
        severity
    FROM {{ ref('stg_crimes') }}
),
moon AS (
    SELECT 
        CAST(date AS DATE) AS date,
        moon_phase
    FROM {{ ref('moon_calendar') }}
)

SELECT 
    m.date,
    m.moon_phase,
    COUNT(c.event_date) AS crime_count,
    AVG(c.severity) AS avg_severity
FROM moon m
LEFT JOIN crimes c ON m.date = c.event_date
WHERE m.date <= CURRENT_DATE()
  AND m.date >= (SELECT MIN(CAST(timestamp AS DATE)) FROM {{ ref('stg_crimes') }})
GROUP BY 1, 2
