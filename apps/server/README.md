# KeyHQ API Worker

Run the Worker locally with Wrangler’s scheduled-event test endpoint:

```sh
bunx wrangler dev --test-scheduled
curl http://localhost:8787/__scheduled
```

The configured `30 2 * * *` trigger is evaluated by Cloudflare in UTC, which
corresponds to 08:00 in Asia/Kolkata. The scheduled handler awaits the
reminder job before completing.
