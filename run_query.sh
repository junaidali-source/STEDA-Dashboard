#!/bin/bash

export PGPASSWORD=$DB_PASSWORD

psql \
  -h $DB_HOST \
  -p 6543 \
  -U $DB_USER \
  -d $DB_NAME \
  -c "
  SELECT
    u.id,
    u.name,
    u.phone_number,
    u.phone_primary,
    u.region,
    u.subjects,
    COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END) as coaching_session_count,
    MAX(cs.session_date)::text as last_coaching_date,
    COUNT(DISTINCT ra.id) as reading_assessment_count,
    COUNT(DISTINCT lpr.id) as lesson_plan_count,
    COUNT(DISTINCT ia.id) as image_analysis_count,
    COUNT(DISTINCT vr.id) as video_request_count
  FROM users u
  LEFT JOIN coaching_sessions cs ON u.id = cs.user_id
  LEFT JOIN reading_assessments ra ON u.id = ra.user_id
  LEFT JOIN lesson_plan_requests lpr ON u.id = lpr.user_id
  LEFT JOIN image_analysis_requests ia ON u.id = ia.user_id
  LEFT JOIN video_requests vr ON u.id = vr.user_id
  GROUP BY u.id, u.name, u.phone_number, u.phone_primary, u.region, u.subjects
  ORDER BY (coaching_session_count + reading_assessment_count + lesson_plan_count + image_analysis_count + video_request_count) DESC
  " > users_data.txt 2>&1
