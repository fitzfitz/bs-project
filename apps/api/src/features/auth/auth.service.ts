import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import type { RegisterInput, LoginInput, GoogleAuthInput } from "./auth.schema";

export async function getPermissionsForRole(db: PrismaClient, tenantRoleId: string) {
  const perms = await db.tenantRolePermission.findMany({
    where: { tenantRoleId },
    select: {
      featureCode: true,
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    },
  });
  const map: Record<string, { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean }> = {};
  for (const p of perms) {
    map[p.featureCode] = {
      canCreate: p.canCreate,
      canRead: p.canRead,
      canUpdate: p.canUpdate,
      canDelete: p.canDelete,
    };
  }
  return map;
}

export const AuthService = {
  async getUserById(db: PrismaClient, id: string) {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        tenantRoleId: true,
        isCustomer: true,
        organizationId: true,
        branchId: true,
        emailOptIn: true,
        staffProfile: { select: { id: true, tier: true } },
        tenantRole: { select: { id: true, name: true, scope: true } },
        organization: { select: { currency: true, currencySymbol: true, locale: true } },
      },
    });
    if (!user || !user.tenantRoleId) return user;

    const permissions = await getPermissionsForRole(db, user.tenantRoleId);
    return { ...user, permissions };
  },

  async resolveOrg(db: PrismaClient, orgSlug: string) {
    const org = await db.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new Error("Organization not found");
    return org;
  },

  async register(db: PrismaClient, data: RegisterInput) {
    const org = await this.resolveOrg(db, data.orgSlug!);

    const customerRole = await db.tenantRole.findFirst({
      where: { scope: "CUSTOMER", organizationId: org.id },
    });
    if (!customerRole) throw new Error("No customer role configured for this organization");

    const existing = await db.user.findUnique({
      where: { organizationId_email: { organizationId: org.id, email: data.email } },
    });
    if (existing) throw new Error("Email already in use");

    const passwordHash = await bcrypt.hash(data.password, 10);

    console.log("DEBUG: org", org?.id, "customerRole", customerRole?.id, "scope", (customerRole as any)?.scope);
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        organizationId: org.id,
        tenantRoleId: customerRole.id,
        isCustomer: true,
      },
    });

    await db.customerMembership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        pointsBalance: 0,
        lifetimePoints: 0,
        tier: "BRONZE",
      },
    });

    await db.notificationPreference.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        emailOptOut: false,
      },
    });

    return {
      ...user,
      tenantRole: { 
        id: customerRole.id, 
        name: customerRole.name, 
        scope: customerRole.scope 
      },
      organization: { 
        currency: org.currency, 
        currencySymbol: org.currencySymbol, 
        locale: org.locale 
      },
    };
  },

  async login(db: PrismaClient, data: LoginInput) {
    const org = await this.resolveOrg(db, data.orgSlug!);

    const user = await db.user.findUnique({
      where: { organizationId_email: { organizationId: org.id, email: data.email } },
      include: {
        tenantRole: { select: { id: true, name: true, scope: true } },
        organization: { select: { currency: true, currencySymbol: true, locale: true } },
      },
    });
    if (!user) return null;

    if (!user.passwordHash) throw new Error("Account uses social login");

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) return null;

    return user;
  },

  async googleAuth(db: PrismaClient, data: GoogleAuthInput & { googleClientId?: string }) {
    const org = await this.resolveOrg(db, data.orgSlug!);

    const parts = data.idToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid Google ID token format");

    const clientId = data.googleClientId;
    if (!clientId) throw new Error("Google auth not configured");

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: data.idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Google ID token");

    const { sub: googleId, email, given_name, family_name, email_verified, picture } = payload;
    if (!email) throw new Error("Google token missing email claim");

    const orgInclude = { organization: { select: { currency: true, currencySymbol: true, locale: true } } };
    const userInclude = { tenantRole: { select: { id: true, name: true, scope: true } }, ...orgInclude };

    let user = await db.user.findFirst({
      where: { organizationId: org.id, googleId },
      include: userInclude,
    });

    if (!user) {
      user = await db.user.findUnique({
        where: { organizationId_email: { organizationId: org.id, email } },
        include: userInclude,
      });

      if (user) {
        user = await db.user.update({
          where: { id: user.id },
          data: { googleId, authProvider: "GOOGLE", emailVerified: !!email_verified, avatar: picture || user.avatar },
          include: userInclude,
        });
      } else {
        const customerRole = await db.tenantRole.findFirst({
          where: { scope: "CUSTOMER", organizationId: org.id },
        });
        if (!customerRole) throw new Error("No customer role configured");

        user = await db.user.create({
          data: {
            email,
            firstName: given_name || "Google",
            lastName: family_name || "User",
            organizationId: org.id,
            tenantRoleId: customerRole.id,
            isCustomer: true,
            googleId,
            authProvider: "GOOGLE",
            emailVerified: !!email_verified,
            avatar: picture || null,
          },
          include: userInclude,
        });

        await db.customerMembership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            pointsBalance: 0,
            lifetimePoints: 0,
            tier: "BRONZE",
          },
        });

        await db.notificationPreference.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            emailOptOut: false,
          },
        });
      }
    }

    return user;
  },

  async createRefreshToken(db: PrismaClient, userId: string, organizationId: string) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return db.refreshToken.create({
      data: { token, userId, organizationId, expiresAt },
    });
  },

  async validateRefreshToken(db: PrismaClient, token: string) {
    const rt = await db.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { tenantRole: { select: { id: true, name: true, scope: true } } } } },
    });

    if (!rt) return null;
    if (rt.expiresAt < new Date()) {
      await db.refreshToken.delete({ where: { id: rt.id } });
      return null;
    }

    return rt;
  },

  async revokeRefreshToken(db: PrismaClient, token: string) {
    await db.refreshToken.deleteMany({ where: { token } });
  },

  async updateUserProfile(db: PrismaClient, userId: string, data: Partial<{ firstName: string; lastName: string; phone: string }>) {
    return db.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        tenantRoleId: true,
        isCustomer: true,
        organizationId: true,
      },
    });
  },

  async forgotPassword(_db: PrismaClient, _email: string) {
    return { message: "If an account exists with this email, you will receive reset instructions." };
  },

  async deleteAccount(db: PrismaClient, userId: string, tenantRoleId: string | null) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    await db.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.customerMembership.deleteMany({ where: { userId } });

      const invalidPasswordHash = await bcrypt.hash("deleted-account-invalid", 10);
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: "Deleted",
          lastName: "User",
          email: `deleted-${userId}@deleted.local`,
          phone: `deleted-${userId}`,
          avatar: null,
          isActive: false,
          passwordHash: invalidPasswordHash,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId,
          tenantRoleId,
          branchId: null,
          action: "DELETE",
          entityType: "User",
          entityId: userId,
          details: { reason: "Account deletion by user" },
        },
      });
    });
  },

  async searchUsers(db: PrismaClient, search: string, excludeWithStaffProfile = false) {
    return db.user.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(excludeWithStaffProfile ? { staffProfile: { is: null } } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, tenantRoleId: true, isCustomer: true, organizationId: true },
      take: 20,
      orderBy: { firstName: "asc" },
    });
  },
};
