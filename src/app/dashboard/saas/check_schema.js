const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://opndglijdmubfxmcobzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wbmRnbGlqZG11YmZ4bWNvYnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTM5NjAsImV4cCI6MjA5NDY2OTk2MH0.isYVajtHXAdeK_UXHcjG53qwd7nw4dyUOabTl8awUzA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log("Checking products table...");
  const { data: products, error: pError } = await supabase.from('products').select('*').limit(1);
  if (pError) {
    console.error("Error reading products:", pError);
  } else {
    console.log("Product columns:", products.length > 0 ? Object.keys(products[0]) : "No records found to analyze columns");
  }

  console.log("Checking financial_accounts table...");
  const { data: accounts, error: aError } = await supabase.from('financial_accounts').select('*').limit(1);
  if (aError) {
    console.error("Error reading financial_accounts:", aError);
  } else {
    console.log("Account columns:", accounts.length > 0 ? Object.keys(accounts[0]) : "No records found to analyze columns");
  }
}

checkSchema();
