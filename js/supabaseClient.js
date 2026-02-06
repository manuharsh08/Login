import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  "https://xhrnfzdmbnhqvikrituv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm5memRtYm5ocXZpa3JpdHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzA5NzgsImV4cCI6MjA4NTk0Njk3OH0.gVUS7-Bq-DdGqb-69hlHzrLHkXxt39aZPTSaJzbhuKQ"
);