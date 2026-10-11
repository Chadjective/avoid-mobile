// app.config.js: the Firebase file the build uses is a real google-services.json
// for this app. The 0.2.4 build failed in Gradle ("Missing project_info object")
// because the file it was given was not one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const appConfig = require("../app.config.js");
const appJson = require("../app.json");

test("config points Android at the checked-in google-services.json", () => {
  const config = appConfig({ config: appJson.expo });
  assert.equal(config.android.googleServicesFile, "./google-services.json");
  assert.equal(config.android.package, "net.avoid.mobile");
});

test("a file without project_info is refused with a plain message", () => {
  assert.throws(() => appConfig.checkGoogleServices("./package.json", "net.avoid.mobile"), /no project_info/);
});

test("a google-services.json for another app is refused", () => {
  assert.throws(() => appConfig.checkGoogleServices("./google-services.json", "com.example.other"), /not com\.example\.other/);
});
