import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const authRepository = {
  async createUser(data: Prisma.UserCreateInput) {
    return await prisma.user.create({
      data,
    });
  },
  async findUserWithFilter(filter: Prisma.UserWhereUniqueInput) {
    return await prisma.user.findUnique({
      where: filter,
    });
  },
};
