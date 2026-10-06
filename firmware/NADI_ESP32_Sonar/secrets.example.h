// Copy to secrets.h (gitignored) and fill in real values.
#ifndef SECRETS_H
#define SECRETS_H

// Primary WiFi
const char *const WIFI_SSID = "your-ssid";
const char *const WIFI_PASSWORD = "your-password";

// Backup WiFi
const char *const BACKUP_WIFI_SSID = "backup-ssid";
const char *const BACKUP_WIFI_PASSWORD = "backup-password";

// Extra fallback hotspots {SSID, password}
const char *const EXTRA_HOTSPOTS[][2] = {
    {"hotspot-ssid", "hotspot-password"},
};

// NADI sensor API endpoint
const char *const NADI_API_URL = "https://your-deployment.vercel.app/api/bencana/sensors";

// Must match SENSOR_NODE_KEY on the server
const char *const SENSOR_NODE_KEY = "your-node-key";

#endif
