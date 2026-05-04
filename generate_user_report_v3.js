const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
  try {
    // Read STEDA CSV
    const csvPath = path.join(__dirname, 'data', 'STEDA List of Teachers-1 .csv');
    console.log('Reading CSV from:', csvPath);
    const stedaUsers = await readCSV(csvPath);
    console.log(`Found ${stedaUsers.length} users in STEDA CSV`);

    // Query all users
    console.log('Fetching users from database...');
    const { data: dbUsers, error: usersError } = await supabase
      .from('users')
      .select('id, name, phone_number, phone_primary, region, subjects');

    if (usersError) throw usersError;
    console.log(`Found ${dbUsers.length} users in database`);

    // Get coaching sessions
    console.log('Fetching coaching sessions...');
    const { data: coachingSessions, error: csError } = await supabase
      .from('coaching_sessions')
      .select('user_id, session_date');

    if (csError) throw csError;

    // Get reading assessments
    console.log('Fetching reading assessments...');
    const { data: readingAssessments, error: raError } = await supabase
      .from('reading_assessments')
      .select('user_id');

    if (raError) throw raError;

    // Get lesson plans
    console.log('Fetching lesson plans...');
    const { data: lessonPlans, error: lpError } = await supabase
      .from('lesson_plan_requests')
      .select('user_id');

    if (lpError) throw lpError;

    // Get image analysis
    console.log('Fetching image analysis requests...');
    const { data: imageAnalysis, error: iaError } = await supabase
      .from('image_analysis_requests')
      .select('user_id');

    if (iaError) throw iaError;

    // Get video requests
    console.log('Fetching video requests...');
    const { data: videoRequests, error: vrError } = await supabase
      .from('video_requests')
      .select('user_id');

    if (vrError) throw vrError;

    // Build user engagement map
    const userEngagement = {};
    dbUsers.forEach(u => {
      userEngagement[u.id] = {
        ...u,
        coaching_session_count: 0,
        last_coaching_date: null,
        reading_assessment_count: 0,
        lesson_plan_count: 0,
        image_analysis_count: 0,
        video_request_count: 0,
      };
    });

    coachingSessions.forEach(cs => {
      if (userEngagement[cs.user_id]) {
        userEngagement[cs.user_id].coaching_session_count++;
        if (!userEngagement[cs.user_id].last_coaching_date || new Date(cs.session_date) > new Date(userEngagement[cs.user_id].last_coaching_date)) {
          userEngagement[cs.user_id].last_coaching_date = cs.session_date;
        }
      }
    });

    readingAssessments.forEach(ra => {
      if (userEngagement[ra.user_id]) userEngagement[ra.user_id].reading_assessment_count++;
    });

    lessonPlans.forEach(lp => {
      if (userEngagement[lp.user_id]) userEngagement[lp.user_id].lesson_plan_count++;
    });

    imageAnalysis.forEach(ia => {
      if (userEngagement[ia.user_id]) userEngagement[ia.user_id].image_analysis_count++;
    });

    videoRequests.forEach(vr => {
      if (userEngagement[vr.user_id]) userEngagement[vr.user_id].video_request_count++;
    });

    const dbUsersEnriched = Object.values(userEngagement).sort((a, b) => {
      const scoreA = (a.coaching_session_count || 0) + (a.reading_assessment_count || 0) + (a.lesson_plan_count || 0) + (a.image_analysis_count || 0) + (a.video_request_count || 0);
      const scoreB = (b.coaching_session_count || 0) + (b.reading_assessment_count || 0) + (b.lesson_plan_count || 0) + (b.image_analysis_count || 0) + (b.video_request_count || 0);
      return scoreB - scoreA;
    });

    // Normalize phone numbers for matching
    const normalizePhone = (phone) => {
      if (!phone) return null;
      return phone.toString().replace(/\D/g, '').slice(-10);
    };

    // Create cross-matched report
    const report = [];
    const matchedPhones = new Set();

    // Process CSV users and match with database
    for (const csvUser of stedaUsers) {
      const csvPhone = normalizePhone(csvUser['WhatsappNo']);

      // Find matching database user
      const dbUser = dbUsersEnriched.find(u => {
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
          'Last Coaching Date': dbUser.last_coaching_date ? dbUser.last_coaching_date.split('T')[0] : '',
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
    for (const dbUser of dbUsersEnriched) {
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
          'Last Coaching Date': dbUser.last_coaching_date ? dbUser.last_coaching_date.split('T')[0] : '',
        });
      }
    }

    // Create Excel workbook with multiple sheets
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

    console.log(`\n✓ Report generated successfully: ${outputPath}`);
    console.log(`\nSummary:`);
    console.log(`- Total STEDA users: ${stedaUsers.length}`);
    console.log(`- Total DB users: ${dbUsersEnriched.length}`);
    console.log(`- Onboarded: ${onboarded.length}`);
    console.log(`- Not Onboarded: ${notOnboarded.length}`);
    console.log(`- With Coaching Sessions: ${withCoaching.length}`);
    console.log(`- Most Engaged (Top 50): ${mostEngaged.length}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

generateReport();
