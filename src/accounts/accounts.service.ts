import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.account.findUnique({
      where: { email },
    });
  }

  findById(id: string) {
    return this.prisma.account.findUnique({
      where: { id },
    });
  }

  create(data: { email: string; password: string }) {
    return this.prisma.account.create({
      data,
    });
  }

  updatePassword(accountId: string, password: string) {
    return this.prisma.account.update({
      where: { id: accountId },
      data: { password },
    });
  }

  async ensureEmailAvailable(email: string) {
    const existing = await this.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email уже зарегистрирован');
    }
  }
}
