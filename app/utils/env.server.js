export function getEnv() {
  return {
    SITENAME: process.env.SITENAME,
    SITE_URL: process.env.SITE_URL,
    API_URL: process.env.API_URL,
    AWSS3_BUCKET_FILES: process.env.AWSS3_BUCKET_FILES,
    TIMEZONE: process.env.TIMEZONE,
    WEB_ADMIN_EMAIL: process.env.WEB_ADMIN_EMAIL,
  };
}
