import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  private static readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateTokens(user: User): AuthTokens {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    } as SignOptions);

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.JWT_REFRESH_SECRET,
      {
        expiresIn: this.JWT_REFRESH_EXPIRES_IN,
      } as SignOptions
    );

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
  }

  static verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, this.JWT_REFRESH_SECRET) as { userId: string };
  }

  static async register(data: z.infer<typeof RegisterSchema>): Promise<User> {
    const { password, ...userData } = data;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: userData.username },
          { email: userData.email },
        ],
      },
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    const passwordHash = await this.hashPassword(password);

    return prisma.user.create({
      data: {
        ...userData,
        passwordHash,
      },
    });
  }

  static async login(credentials: z.infer<typeof LoginSchema>): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({
      where: { username: credentials.username },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.generateTokens(user);

    return { user, tokens };
  }

  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const { userId } = this.verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  static async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async updateUser(id: string, data: z.infer<typeof UpdateUserSchema>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  static async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  static async listUsers(options: {
    skip?: number;
    take?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
  } = {}): Promise<{ users: User[]; total: number }> {
    const { skip = 0, take = 50, search, role, isActive } = options;

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }
}