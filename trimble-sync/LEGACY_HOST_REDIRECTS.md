# Legacy Host Redirects

## Purpose
308 redirect middleware for hostname migrations (e.g., old.synology.me → new.synology.me) without requiring Android app updates.

## ⚠️ IMPORTANT LIMITATION
**This redirect ONLY works when the incoming Host header resolves to this server.**

- ✅ **Works for**: `pardysurveys.synology.me`, custom domains under your control
- ❌ **Does NOT work for**: `*.direct.quickconnect.to` traffic through Synology's relay

**Why?** QuickConnect's relay terminates TLS on Synology's infrastructure and doesn't forward the original Host header to your server. The request never reaches your middleware.

## Configuration
Set in `docker-compose.yml`:
```yaml
HOST_REDIRECTS_ENABLED=false                          # Default: OFF
HOST_REDIRECTS_LEGACY_HOSTS=old.synology.me           # Comma-separated list
HOST_REDIRECTS_TARGET_HOST=new.synology.me            # Target hostname
HOST_REDIRECTS_TARGET_PROTO=https                     # Target protocol
```

## How It Works
1. Old client POSTs to `https://old.synology.me/api/upload-field-data-android`
2. Server responds with `308 Permanent Redirect` to `https://new.synology.me/api/upload-field-data-android`
3. OkHttp client automatically follows redirect with POST body intact
4. Upload completes successfully on new hostname

## Use Cases
- ✅ Future hostname migrations (myoldname.synology.me → mynewname.synology.me)
- ✅ Custom domain transitions (old.example.com → new.example.com)
- ❌ Migrating controllers away from QuickConnect (requires APK update)

## Rollback
**Set `HOST_REDIRECTS_ENABLED=false` and restart:**
```bash
sudo docker-compose restart trimble-sync
```

## Diagnostics
```bash
curl https://pardysurveys.synology.me/api/whoami
```

Check response:
- `redirectsEnabled: true` = Feature active
- `targetHost` = Where redirects point to
- `host`, `xForwardedHost`, `xForwardedProto` = Verify proxy headers
