/**
 * @type {{ GOOGLE: "GOOGLE"; GITHUB: "GITHUB"; EMAIL_PASSWORD: "EMAIL_PASSWORD"} as const}
 */
export const UserLoginType = {
  GOOGLE: "GOOGLE",
  GITHUB: "GITHUB",
  EMAIL_PASSWORD: "EMAIL_PASSWORD",
};

export const AvailableSocialLogins = Object.values(UserLoginType);

export const USER_TEMPORARY_TOKEN_EXPIRY = 20 * 60 * 1000; // 20 minutes

export const USER_TYPES = {
  ADMIN: "admin",
  INSTITUTION: "institution",
  WAREHOUSE: "warehouse",
};
