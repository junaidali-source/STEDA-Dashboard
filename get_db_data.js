const { Client } = require('pg');
require('dotenv').config();

async function getData() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: 6543, // Use transaction mode port
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000, // 2 minute timeout
  });

  try {
    await client.connect();

    const query = `
      SELECT
        u.id,
        COALESCE(u.name, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as name,
        u.phone_number,
        u.region,
        u.subjects_taught::text as subjects,
        COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END)::int as coaching_session_count,
        MAX(cs.created_at) as last_coaching_date,
        COUNT(DISTINCT ra.id)::int as reading_assessment_count,
        COUNT(DISTINCT lpr.id)::int as lesson_plan_count,
        COUNT(DISTINCT ia.id)::int as image_analysis_count,
        COUNT(DISTINCT vr.id)::int as video_request_count
      FROM users u
      LEFT JOIN coaching_sessions cs ON u.id = cs.user_id
      LEFT JOIN reading_assessments ra ON u.id = ra.user_id
      LEFT JOIN lesson_plan_requests lpr ON u.id = lpr.user_id
      LEFT JOIN image_analysis_requests ia ON u.id = ia.user_id
      LEFT JOIN video_requests vr ON u.id = vr.user_id
      GROUP BY u.id, u.name, u.first_name, u.last_name, u.phone_number, u.region, u.subjects_taught
      ORDER BY (COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END) + COUNT(DISTINCT ra.id) + COUNT(DISTINCT lpr.id) + COUNT(DISTINCT ia.id) + COUNT(DISTINCT vr.id)) DESC
    `;

    console.log('Executing query...');
    const result = await client.query(query);
    console.log(JSON.stringify(result.rows));
  } finally {
    await client.end();
  }
}

getData().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
