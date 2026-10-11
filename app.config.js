// Extends app.json. The only dynamic part: the Firebase file Android push
// needs (android.googleServicesFile).
//
// It is the google-services.json checked in next to this file (Firebase
// project avoid-net, package net.avoid.mobile). That file is not a secret:
// Firebase ships its contents inside every APK. The 0.2.4 build first read it
// from the EAS file variable GOOGLE_SERVICES_JSON instead, and the uploaded
// file was not a google-services.json, so Gradle failed with "Missing
// project_info object". The variable is no longer read.
//
// The file is checked here, at config time, so a wrong file stops the build
// in seconds with a plain message instead of four minutes into Gradle.
const fs = require("node:fs");
const path = require("node:path");

const GOOGLE_SERVICES = "./google-services.json";

function checkGoogleServices(file, androidPackage) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(path.resolve(__dirname, file), "utf8"));
  } catch (err) {
    throw new Error(`${file} could not be read as JSON: ${err.message}`);
  }
  if (!json.project_info) {
    throw new Error(
      `${file} has no project_info, so it is not a google-services.json (a Firebase service-account key looks similar). ` +
        "Download it from Firebase console > Project settings > Your apps > Android.",
    );
  }
  const packages = (json.client ?? []).map((c) => c?.client_info?.android_client_info?.package_name);
  if (androidPackage && !packages.includes(androidPackage)) {
    throw new Error(`${file} is for ${packages.join(", ") || "no Android app"}, not ${androidPackage}.`);
  }
}

module.exports = ({ config }) => {
  checkGoogleServices(GOOGLE_SERVICES, config.android?.package);
  return { ...config, android: { ...config.android, googleServicesFile: GOOGLE_SERVICES } };
};

module.exports.checkGoogleServices = checkGoogleServices;
