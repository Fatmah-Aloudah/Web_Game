// Configure your GitHub-hosted databases here.
// Example raw URL:
// https://raw.githubusercontent.com/YOUR-USER/YOUR-REPO/main/db/en.json
// Leave the URL empty to use the bundled local database.
window.QUIZ_CONFIG = {
  githubDb: {
    en: "",
    ar: ""
  },
  localDb: {
    en: "db/en.json",
    ar: "db/ar.json"
  },
  defaultTimerSeconds: 30
};
