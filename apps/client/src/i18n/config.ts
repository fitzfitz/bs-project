import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonEn from "./locales/en/common.json";
import navEn from "./locales/en/nav.json";
import authEn from "./locales/en/auth.json";
import homeEn from "./locales/en/home.json";
import bookingEn from "./locales/en/booking.json";
import branchesEn from "./locales/en/branches.json";
import loyaltyEn from "./locales/en/loyalty.json";
import reviewsEn from "./locales/en/reviews.json";
import profileEn from "./locales/en/profile.json";
import notificationsEn from "./locales/en/notifications.json";
import paymentsEn from "./locales/en/payments.json";
import historyEn from "./locales/en/history.json";
import legalEn from "./locales/en/legal.json";

import commonId from "./locales/id/common.json";
import navId from "./locales/id/nav.json";
import authId from "./locales/id/auth.json";
import homeId from "./locales/id/home.json";
import bookingId from "./locales/id/booking.json";
import branchesId from "./locales/id/branches.json";
import loyaltyId from "./locales/id/loyalty.json";
import reviewsId from "./locales/id/reviews.json";
import profileId from "./locales/id/profile.json";
import notificationsId from "./locales/id/notifications.json";
import paymentsId from "./locales/id/payments.json";
import historyId from "./locales/id/history.json";
import legalId from "./locales/id/legal.json";

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
        nav: navEn,
        auth: authEn,
        home: homeEn,
        booking: bookingEn,
        branches: branchesEn,
        loyalty: loyaltyEn,
        reviews: reviewsEn,
        profile: profileEn,
        notifications: notificationsEn,
        payments: paymentsEn,
        history: historyEn,
        legal: legalEn,
      },
      id: {
        common: commonId,
        nav: navId,
        auth: authId,
        home: homeId,
        booking: bookingId,
        branches: branchesId,
        loyalty: loyaltyId,
        reviews: reviewsId,
        profile: profileId,
        notifications: notificationsId,
        payments: paymentsId,
        history: historyId,
        legal: legalId,
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
