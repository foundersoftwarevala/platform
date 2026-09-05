import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import fs from 'fs';
import path from 'path';

export const Route = createFileRoute("/api/internal/apply-migrations")({
  server: {
    handlers: {
      POST: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        try {
          // Get credentials from environment
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            return Response.json({
              error: 'Missing Supabase credentials in environment',
              has_url: !!supabaseUrl,
              has_key: !!supabaseKey,
            }, { status: 500 });
          }
          
          const results = [];
          const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
          
          // Execute each migration file
          const migrationFiles = [
            '20260809100007_0d3a5b09-2f33-4853-a346-e387fde9ee57.sql',
            '20260815_reseller_tables.sql',
            '20260815_reseller_user_mapping_and_rls.sql'
          ];
          
          for (const fileName of migrationFiles) {
            const filePath = path.join(migrationsDir, fileName);
            if (!fs.existsSync(filePath)) {
              results.push({ file: fileName, status: 'NOT_FOUND' });
              continue;
            }
            
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            
            try {
              const headers = new Headers({
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              });

              const requestUrl = new URL('/rest/v1/sql', supabaseUrl).toString();
              console.log('[apply-migrations] posting SQL to', requestUrl);
              console.log('[apply-migrations] headers', {
                apikey: supabaseKey.slice(0, 12) + '...',
                authorization: `Bearer ${supabaseKey.slice(0, 12)}...`,
                contentType: headers.get('Content-Type'),
              });

              const response = await fetch(requestUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query: sqlContent.slice(0, 200) }),
              });
              
              const responseText = await response.text();
              results.push({
                file: fileName,
                status: response.status,
                ok: response.ok,
                preview: responseText.slice(0, 300),
              });
              
              if (!response.ok) {
                return Response.json({
                  error: 'Migration failed',
                  failedFile: fileName,
                  httpStatus: response.status,
                  response: responseText.slice(0, 500),
                  results: results,
                }, { status: 400 });
              }
            } catch (error) {
              results.push({
                file: fileName,
                status: 'ERROR',
                error: error instanceof Error ? error.message : String(error),
              });
              return Response.json({
                error: 'Migration execution error',
                failedFile: fileName,
                errorMessage: error instanceof Error ? error.message : String(error),
                results: results,
              }, { status: 400 });
            }
          }
          
          return Response.json({
            success: true,
            message: 'All migrations applied successfully',
            results: results,
          });
          
        } catch (error) {
          return Response.json({
            error: error instanceof Error ? error.message : String(error),
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
          }, { status: 500 });
        }
      },

      GET: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        return Response.json({
          message: "Migration Execution Endpoint",
          method: "POST to this endpoint to execute all pending migrations",
          note: "Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment",
        });
      },
    },
  },
});
