import { db } from "./db";
import { companies, customers, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  try {
    console.log("🌱 Iniciando seed do banco de dados...");

    // Verificar se já existe o admin
    const existingAdmin = await db.select().from(users).where(
      eq(users.email, 'admin@opusclean.com')
    ).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log("✅ Usuário admin já existe. Seed não é necessário.");
      console.log("📋 Credenciais: admin / admin123");
      return;
    }

    // Criar Company
    console.log("📦 Criando empresa...");
    const [company] = await db.insert(companies).values({
      id: 'company-opus-default',
      name: 'Grupo OPUS',
      address: 'Av. Paulista, 1000 - São Paulo, SP',
      cnpj: '12.345.678/0001-90',
      email: 'contato@grupoopus.com.br',
      phone: '(11) 3000-0000',
      isActive: true
    }).returning();
    console.log(`✅ Empresa criada: ${company.name}`);

    // Criar Customer
    console.log("👤 Criando cliente...");
    const [customer] = await db.insert(customers).values({
      id: 'customer-teste-default',
      name: 'Cliente Teste',
      companyId: company.id,
      isActive: true
    }).returning();
    console.log(`✅ Cliente criado: ${customer.name}`);

    // Criar Admin User
    console.log("🔐 Criando usuário admin...");
    // Hash pré-calculado para 'admin123' para evitar delay no deploy
    const hashedPassword = '$2b$12$OysqfXqxwvfxZvr9GZnYFOMLIoiTYcMfAa6QJLEHbmC7R5Ikvl8V6';
    const [admin] = await db.insert(users).values({
      id: 'user-admin-' + Date.now(),
      role: 'admin',
      name: 'Admin Teste',
      email: 'admin@opusclean.com',
      username: 'admin',
      password: hashedPassword,
      companyId: company.id,
      isActive: true,
      authProvider: 'local',
      userType: 'opus_user'
    }).returning();
    console.log(`✅ Admin criado: ${admin.username}`);

    console.log("\n🎉 Seed concluído com sucesso!");
    console.log("\n📋 Credenciais de acesso:");
    console.log("   Usuário: admin");
    console.log("   Senha: admin123");
    
  } catch (error) {
    console.error("❌ Erro ao fazer seed:", error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
