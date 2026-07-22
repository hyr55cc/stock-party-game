// ============================================================
//  إعدادات Supabase — عبّي القيمتين التاليتين من مشروعك على supabase.com
//  Project Settings > API > Project URL / anon public key
//  هاتين القيمتين آمنتين للاستخدام بواجهة العميل (ليستا سرّيتين)
// ============================================================
const SUPABASE_URL = 'Ysb_publishable_MfmoQQvnZ4-K_L-Q5GqIcw_5tbzlb94';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdGd5bHJobXp0aG56Z25qY2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTAxMDIsImV4cCI6MjEwMDI2NjEwMn0.HywtByDbxIR9JT210unvn0wUdglJlBRWooM09t0QaXQ';

const supabaseClient = (SUPABASE_URL.startsWith('http'))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
