const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const { Client } = require('pg');
require('dotenv').config();

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function generateReport() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 6543),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Read STEDA CSV
    const csvPath = path.join(__dirname, 'data', 'STEDA List of Teachers-1 .csv');
    console.log('Reading CSV from:', csvPath);
    const stedaUsers = await readCSV(csvPath);
    console.log(`Found ${stedaUsers.length} users in STEDA CSV`);

    // Connect to database
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');

    // Query all users with engagement data
    console.log('Querying database...');
    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.phone_number,
        u.phone_primary,
        u.region,
        u.subjects,
        COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END)::int as coaching_session_count,
        MAX(cs.session_date) as last_coaching_date,
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
      GROUP BY u.id, u.name, u.phone_number, u.phone_primary, u.region, u.subjects
      ORDER BY (COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END) + COUNT(DISTINCT ra.id) + COUNT(DISTINCT lpr.id) + COUNT(DISTINCT ia.id) + COUNT(DISTINCT vr.id)) DESC
    `;

    const result = await client.query(usersQuery);
    const dbUsers = result.rows;
    console.log(`Found ${dbUsers.length} users in database`);

    // Normalize phone numbers for matching
    const normalizePhone = (phone) => {
      if (!phone) return null;
      return phone.toString().replace(/\D/g, '').slice(-10);
    };

    // Create cross-matched report
    const report = [];
    const matchedPhones = new Set();

    console.log('Cross-matching users...');

    // Process CSV users and match with database
    for (const csvUser of stedaUsers) {
      const csvPhone = normalizePhone(csvUser['WhatsappNo']);

      // Find matching database user
      const dbUser = dbUsers.find(u => {
        const dbPhone = normalizePhone(u.phone_number || u.phone_primary);
        return dbPhone === csvPhone;
      });

      if (dbUser) {
        matchedPhones.add(csvPhone);
        report.push({
          'Name': csvUser['NameOfParticipant'] || '',
          'WhatsApp Number': csvUser['WhatsappNo'] || '',
          'SEMIS ID': csvUser['SEMISID'] || '',
          'Region': dbUser.region || csvUser['District'] || '',
          'Subjects': dbUser.subjects || '',
          'School': csvUser['NameOfSchool'] || '',
          'District': csvUser['District'] || '',
          'Onboarding Status': 'ONBOARDED',
          'Coaching Sessions': dbUser.coaching_session_count || 0,
          'Reading Assessments': dbUser.reading_assessment_count || 0,
          'Lesson Plans': dbUser.lesson_plan_count || 0,
          'Image Analysis': dbUser.image_analysis_count || 0,
          'Video Requests': dbUser.video_request_count || 0,
          'Total Engagement Score': (dbUser.coaching_session_count || 0) + (dbUser.reading_assessment_count || 0) + (dbUser.lesson_plan_count || 0) + (dbUser.image_analysis_count || 0) + (dbUser.video_request_count || 0),
          'Last Coaching Date': dbUser.last_coaching_date ? dbUser.last_coaching_date.toISOString().split('T')[0] : '',
        });
      } else {
        report.push({
          'Name': csvUser['NameOfParticipant'] || '',
          'WhatsApp Number': csvUser['WhatsappNo'] || '',
          'SEMIS ID': csvUser['SEMISID'] || '',
          'Region': csvUser['District'] || '',
          'Subjects': '',
          'School': csvUser['NameOfSchool'] || '',
          'District': csvUser['District'] || '',
          'Onboarding Status': 'NOT ONBOARDED',
          'Coaching Sessions': 0,
          'Reading Assessments': 0,
          'Lesson Plans': 0,
          'Image Analysis': 0,
          'Video Requests': 0,
          'Total Engagement Score': 0,
          'Last Coaching Date': '',
        });
      }
    }

    // Add database users who aren't in STEDA list
    for (const dbUser of dbUsers) {
      const dbPhone = normalizePhone(dbUser.phone_number || dbUser.phone_primary);
      if (!matchedPhones.has(dbPhone)) {
        report.push({
          'Name': dbUser.name || '',
          'WhatsApp Number': dbUser.phone_number || dbUser.phone_primary || '',
          'SEMIS ID': '',
          'Region': dbUser.region || '',
          'Subjects': dbUser.subjects || '',
          'School': '',
          'District': '',
          'Onboarding Status': 'IN DATABASE (NOT IN STEDA)',
          'Coaching Sessions': dbUser.coaching_session_count || 0,
          'Reading Assessments': dbUser.reading_assessment_count || 0,
          'Lesson Plans': dbUser.lesson_plan_count || 0,
          'Image Analysis': dbUser.image_analysis_count || 0,
          'Video Requests': dbUser.video_request_count || 0,
          'Total Engagement Score': (dbUser.coaching_session_count || 0) + (dbUser.reading_assessment_count || 0) + (dbUser.lesson_plan_count || 0) + (dbUser.image_analysis_count || 0) + (dbUser.video_request_count || 0),
          'Last Coaching Date': dbUser.last_coaching_date ? dbUser.last_coaching_date.toISOString().split('T')[0] : '',
        });
      }
    }

    // Create Excel workbook with multiple sheets
    console.log('Creating Excel workbook...');
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Complete Report
    const completeSheet = workbook.addWorksheet('Complete Report');
    const headers = Object.keys(report[0] || {});
    completeSheet.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
    completeSheet.addRows(report);

    // Add formatting
    completeSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    completeSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    // Sheet 2: Onboarded Users
    const onboardedSheet = workbook.addWorksheet('Onboarded Users');
    const onboarded = report.filter(r => r['Onboarding Status'] === 'ONBOARDED');
    onboardedSheet.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
    onboardedSheet.addRows(onboarded);
    onboardedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    onboardedSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: 'FF70AD47' };

    // Sheet 3: Not Onboarded Users
    const notOnboardedSheet = workbook.addWorksheet('Not Onboarded');
    const notOnboarded = report.filter(r => r['Onboarding Status'] === 'NOT ONBOARDED');
    notOnboardedSheet.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
    notOnboardedSheet.addRows(notOnboarded);
    notOnboardedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    notOnboardedSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: 'FFC55A11' };

    // Sheet 4: Coaching Sessions Participants
    const coachingSheet = workbook.addWorksheet('Coaching Sessions');
    const withCoaching = report.filter(r => r['Coaching Sessions'] > 0).sort((a, b) => b['Coaching Sessions'] - a['Coaching Sessions']);
    coachingSheet.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
    coachingSheet.addRows(withCoaching);
    coachingSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    coachingSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: 'FF4472C4' };

    // Sheet 5: Most Engaged Users
    const engagedSheet = workbook.addWorksheet('Most Engaged');
    const mostEngaged = report.filter(r => r['Total Engagement Score'] > 0).sort((a, b) => b['Total Engagement Score'] - a['Total Engagement Score']).slice(0, 50);
    engagedSheet.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
    engagedSheet.addRows(mostEngaged);
    engagedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    engagedSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: 'FF7030A0' };

    // Save workbook
    const outputPath = path.join(__dirname, 'reports', 'STEDA_User_Report.xlsx');
    await workbook.xlsx.writeFile(outputPath);

    console.log(`\n✓ Report generated successfully!`);
    console.log(`Location: ${outputPath}`);
    console.log(`\nSummary:`);
    console.log(`- Total STEDA users: ${stedaUsers.length}`);
    console.log(`- Total DB users: ${dbUsers.length}`);
    console.log(`- Onboarded: ${onboarded.length}`);
    console.log(`- Not Onboarded: ${notOnboarded.length}`);
    console.log(`- With Coaching Sessions: ${withCoaching.length}`);
    console.log(`- Most Engaged (Top 50): ${mostEngaged.length}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

generateReport();
