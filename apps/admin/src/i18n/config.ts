import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonEn from "./locales/en/common.json";
import sidebarEn from "./locales/en/sidebar.json";
import authEn from "./locales/en/auth.json";
import dashboardEn from "./locales/en/dashboard.json";
import queueEn from "./locales/en/queue.json";
import posEn from "./locales/en/pos.json";
import transactionsEn from "./locales/en/transactions.json";
import staffEn from "./locales/en/staff.json";
import attendanceEn from "./locales/en/attendance.json";
import commissionsEn from "./locales/en/commissions.json";
import payrollEn from "./locales/en/payroll.json";
import inventoryEn from "./locales/en/inventory.json";
import cashDrawerEn from "./locales/en/cash-drawer.json";
import reviewsEn from "./locales/en/reviews.json";
import loyaltyEn from "./locales/en/loyalty.json";
import campaignsEn from "./locales/en/campaigns.json";
import branchesEn from "./locales/en/branches.json";
import analyticsEn from "./locales/en/analytics.json";
import reportsEn from "./locales/en/reports.json";
import usersEn from "./locales/en/users.json";
import crmEn from "./locales/en/crm.json";
import auditEn from "./locales/en/audit.json";
import financeEn from "./locales/en/finance.json";
import configEn from "./locales/en/config.json";
import notificationsEn from "./locales/en/notifications.json";
import retentionEn from "./locales/en/retention.json";
import servicesEn from "./locales/en/services.json";
import barberPortalEn from "./locales/en/barber-portal.json";
import waitlistEn from "./locales/en/waitlist.json";

import commonId from "./locales/id/common.json";
import sidebarId from "./locales/id/sidebar.json";
import authId from "./locales/id/auth.json";
import dashboardId from "./locales/id/dashboard.json";
import queueId from "./locales/id/queue.json";
import posId from "./locales/id/pos.json";
import transactionsId from "./locales/id/transactions.json";
import staffId from "./locales/id/staff.json";
import attendanceId from "./locales/id/attendance.json";
import commissionsId from "./locales/id/commissions.json";
import payrollId from "./locales/id/payroll.json";
import inventoryId from "./locales/id/inventory.json";
import cashDrawerId from "./locales/id/cash-drawer.json";
import reviewsId from "./locales/id/reviews.json";
import loyaltyId from "./locales/id/loyalty.json";
import campaignsId from "./locales/id/campaigns.json";
import branchesId from "./locales/id/branches.json";
import analyticsId from "./locales/id/analytics.json";
import reportsId from "./locales/id/reports.json";
import usersId from "./locales/id/users.json";
import crmId from "./locales/id/crm.json";
import auditId from "./locales/id/audit.json";
import financeId from "./locales/id/finance.json";
import configId from "./locales/id/config.json";
import notificationsId from "./locales/id/notifications.json";
import retentionId from "./locales/id/retention.json";
import servicesId from "./locales/id/services.json";
import barberPortalId from "./locales/id/barber-portal.json";
import waitlistId from "./locales/id/waitlist.json";

export const defaultNS = "common";
export const supportedLanguages = ["en", "id"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        sidebar: sidebarEn,
        auth: authEn,
        dashboard: dashboardEn,
        queue: queueEn,
        pos: posEn,
        transactions: transactionsEn,
        staff: staffEn,
        attendance: attendanceEn,
        commissions: commissionsEn,
        payroll: payrollEn,
        inventory: inventoryEn,
        "cash-drawer": cashDrawerEn,
        reviews: reviewsEn,
        loyalty: loyaltyEn,
        campaigns: campaignsEn,
        branches: branchesEn,
        analytics: analyticsEn,
        reports: reportsEn,
        users: usersEn,
        crm: crmEn,
        audit: auditEn,
        finance: financeEn,
        config: configEn,
        notifications: notificationsEn,
        retention: retentionEn,
        services: servicesEn,
        "barber-portal": barberPortalEn,
        waitlist: waitlistEn,
      },
      id: {
        common: commonId,
        sidebar: sidebarId,
        auth: authId,
        dashboard: dashboardId,
        queue: queueId,
        pos: posId,
        transactions: transactionsId,
        staff: staffId,
        attendance: attendanceId,
        commissions: commissionsId,
        payroll: payrollId,
        inventory: inventoryId,
        "cash-drawer": cashDrawerId,
        reviews: reviewsId,
        loyalty: loyaltyId,
        campaigns: campaignsId,
        branches: branchesId,
        analytics: analyticsId,
        reports: reportsId,
        users: usersId,
        crm: crmId,
        audit: auditId,
        finance: financeId,
        config: configId,
        notifications: notificationsId,
        retention: retentionId,
        services: servicesId,
        "barber-portal": barberPortalId,
        waitlist: waitlistId,
      },
    },
    defaultNS,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;
