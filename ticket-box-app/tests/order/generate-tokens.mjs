import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is not defined in .env");
  }

  console.log("Fetching load test users from database...");
  // Lấy tối đa 80.000 user để phục vụ bài test
  const users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: "loadtest",
        endsWith: "@ticketbox.test",
      },
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
    orderBy: {
      email: "asc",
    },
    take: 80000,
  });

  console.log(`Found ${users.length} load test users.`);
  if (users.length === 0) {
    console.log("No load test users found. Please run 'npm run db:seed' first.");
    return;
  }

  console.log("Generating JWT tokens (signing without bcrypt)...");
  const tokenData = users.map((user) => {
    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        jti: randomUUID(),
      },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return {
      userId: user.id,
      email: user.email,
      token,
    };
  });

  // Chia nhỏ thành 3 file cho 3 client và 1 file tổng hợp
  const client1Data = tokenData.slice(0, 30000);
  const client2Data = tokenData.slice(30000, 60000);
  const client3Data = tokenData.slice(60000, 80000);

  fs.writeFileSync(path.join(__dirname, "tokens_client_1.json"), JSON.stringify(client1Data, null, 2), "utf-8");
  fs.writeFileSync(path.join(__dirname, "tokens_client_2.json"), JSON.stringify(client2Data, null, 2), "utf-8");
  fs.writeFileSync(path.join(__dirname, "tokens_client_3.json"), JSON.stringify(client3Data, null, 2), "utf-8");
  
  // Ghi thêm file tổng hợp tokens.json phòng trường hợp test 1 máy
  fs.writeFileSync(path.join(__dirname, "tokens.json"), JSON.stringify(tokenData, null, 2), "utf-8");

  console.log("Successfully generated tokens:");
  console.log(`- Total: tokens.json (${tokenData.length} users)`);
  console.log(`- Client 1: tokens_client_1.json (${client1Data.length} users)`);
  console.log(`- Client 2: tokens_client_2.json (${client2Data.length} users)`);
  console.log(`- Client 3: tokens_client_3.json (${client3Data.length} users)`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
