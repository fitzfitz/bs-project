#!/bin/bash
find apps/api/src -type f -name "*.ts" -exec sed -i 's/import type { PrismaClient.* } from "@prisma\/client";/import { PrismaClient, Prisma } from "@prisma\/client";/' {} +
find apps/api/src -type f -name "*.ts" -exec sed -i 's/import { type PrismaClient.* } from "@prisma\/client";/import { PrismaClient, Prisma } from "@prisma\/client";/' {} +
find apps/api/src -type f -name "*.ts" -exec sed -i 's/import { PrismaClient.* } from "@prisma\/client";/import { PrismaClient, Prisma } from "@prisma\/client";/' {} +
find apps/api/src -type f -name "*.ts" -exec sed -i 's/import type { PrismaClient } from "@prisma\/client";/import { PrismaClient } from "@prisma\/client";/' {} +
