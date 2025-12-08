import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Pool de conexões PostgreSQL
// Configurável via variáveis de ambiente para otimização em VM
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PGPOOL_MAX || '10'),
  idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.PGPOOL_CONNECTION_TIMEOUT || '10000'),
});

export const db = drizzle({ client: pool, schema });