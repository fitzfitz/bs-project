import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  ClockInInput,
  ClockOutInput,
  CreateShiftBlockInput,
  UpdateShiftBlockInput,
} from "./attendance.schema";

export const AttendanceService = {
  // --- Attendance ---

  async listAttendance(
    db: PrismaClient,
    filters: {
      staffProfileId?: string;
      branchId?: string;
      startDate?: string;
      endDate?: string;
      page: number;
      limit: number;
    }
  ) {
    const where: Prisma.StaffAttendanceWhereInput = {
      ...(filters.staffProfileId && { staffProfileId: filters.staffProfileId }),
    };

    if (filters.startDate || filters.endDate) {
      where.clockIn = {};
      if (filters.startDate) where.clockIn.gte = new Date(filters.startDate);
      if (filters.endDate) where.clockIn.lte = new Date(filters.endDate);
    }

    const total = await db.staffAttendance.count({ where });
    const data = await db.staffAttendance.findMany({
      where,
      include: { staff: { include: { user: true } } },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      orderBy: { clockIn: "desc" },
    });

    return {
      data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async clockIn(db: PrismaClient, userId: string, _data: ClockInInput) {
    const profile = await db.staffProfile.findUnique({ where: { userId }, select: { id: true, organizationId: true } });
    if (!profile) throw new Error("Staff profile not found");

    const existing = await db.staffAttendance.findFirst({
      where: {
        staffProfileId: profile.id,
        clockOut: null,
      },
    });

    if (existing) {
      throw new Error("Already clocked in");
    }

    const [attendance] = await db.$transaction([
      db.staffAttendance.create({
        data: {
          staffProfileId: profile.id,
          organizationId: profile.organizationId,
          clockIn: new Date(),
        },
      }),
      db.staffProfile.update({
        where: { id: profile.id },
        data: { status: "AVAILABLE" },
      }),
    ]);

    return attendance;
  },

  async clockOut(db: PrismaClient, attendanceId: string, _data: ClockOutInput) {
    const attendance = await db.staffAttendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) throw new Error("Attendance record not found");
    if (attendance.clockOut) throw new Error("Already clocked out");

    const [updated] = await db.$transaction([
      db.staffAttendance.update({
        where: { id: attendanceId },
        data: {
          clockOut: new Date(),
        },
      }),
      db.staffProfile.update({
        where: { id: attendance.staffProfileId },
        data: { status: "OFF_DUTY" },
      }),
    ]);

    return updated;
  },

  // --- Shifts / Blocks ---

  async listShifts(
    db: PrismaClient,
    filters: {
      staffProfileId?: string;
      branchId?: string;
      date?: string;
    }
  ) {
    const where: Prisma.ShiftScheduleWhereInput = {
      ...(filters.staffProfileId && { staffProfileId: filters.staffProfileId }),
      ...(filters.date && { date: new Date(filters.date) }),
    };

    return await db.shiftSchedule.findMany({
      where,
      include: { staff: { include: { user: true } } },
      orderBy: { date: "asc" },
    });
  },

  async createShiftBlock(db: PrismaClient, data: CreateShiftBlockInput) {
    const staff = await db.staffProfile.findUnique({ where: { id: data.staffProfileId }, select: { organizationId: true } });
    if (!staff) throw new Error("Staff profile not found");
    let shiftDate = new Date(data.date);
    shiftDate.setHours(0, 0, 0, 0);

    const shift = await db.shiftSchedule.upsert({
      where: {
        staffProfileId_date: {
          staffProfileId: data.staffProfileId,
          date: shiftDate,
        },
      },
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        note: data.notes ?? undefined,
      },
      create: {
        staffProfileId: data.staffProfileId,
        organizationId: staff.organizationId,
        date: shiftDate,
        startTime: data.startTime,
        endTime: data.endTime,
        note: data.notes ?? undefined,
      },
    });
    return shift;
  },

  async updateShiftBlock(
    db: PrismaClient,
    id: string,
    data: UpdateShiftBlockInput
  ) {
    const shift = await db.shiftSchedule.update({
      where: { id },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        startTime: data.startTime ?? undefined,
        endTime: data.endTime ?? undefined,
      },
    });
    return shift;
  },

  async deleteShiftBlock(db: PrismaClient, id: string) {
    await db.shiftSchedule.delete({
      where: { id },
    });
  },
};
