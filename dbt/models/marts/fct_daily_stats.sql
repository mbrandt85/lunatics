WITH base AS (
    SELECT * FROM {{ ref('int_moon_correlation') }}
),
historical_avg AS (
    SELECT 
        moon_phase,
        AVG(crime_count) AS avg_crimes_for_phase
    FROM base
    GROUP BY 1
)

SELECT 
    b.date,
    b.moon_phase,
    b.crime_count AS total_crimes,
    (b.crime_count - h.avg_crimes_for_phase) / NULLIF(h.avg_crimes_for_phase, 0) AS deviation_score
FROM base b
JOIN historical_avg h ON b.moon_phase = h.moon_phase
