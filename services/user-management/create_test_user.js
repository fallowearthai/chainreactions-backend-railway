const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://keacwlgxmxhbzskiximn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYWN3bGd4bXhoYnpza2l4aW1uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzYzOTY2NCwiZXhwIjoyMDQzMjE1NjY0fQ.I7m4R5TgKH_gGzKTYJZOQkHYa8rG47nNqC3SHFp4JQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  try {
    console.log('Creating test user...');

    // Create a test user with a known password
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'test@admin.com',
      password: 'TestAdmin123!',
      email_confirm: true,
      user_metadata: {
        display_name: 'Test Admin User'
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      return;
    }

    console.log('User created successfully:', data.user);

    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: data.user.email,
        display_name: 'Test Admin User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    } else {
      console.log('Profile created successfully');
    }

    // Create user role record
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: data.user.id,
        role: 'admin',
        assigned_by: 'system',
        assigned_at: new Date().toISOString()
      });

    if (roleError) {
      console.error('Error creating role:', roleError);
    } else {
      console.log('Role created successfully');
    }

    // Create user credits record
    const { error: creditsError } = await supabase
      .from('user_usage_credits')
      .insert({
        user_id: data.user.id,
        ordinary_search_credits: 1000,
        long_search_credits: 100,
        account_type: 'admin',
        credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (creditsError) {
      console.error('Error creating credits:', creditsError);
    } else {
      console.log('Credits created successfully');
    }

    console.log('✅ Test admin user created successfully!');
    console.log('Email: test@admin.com');
    console.log('Password: TestAdmin123!');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTestUser();